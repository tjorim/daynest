"""Unit tests for daynest.client."""

import asyncio
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import aiohttp
import pytest

from daynest.client import DaynestClient
from daynest.exceptions import (
    DaynestAuthError,
    DaynestCommunicationError,
    DaynestMalformedResponseError,
    DaynestNotFoundError,
    DaynestServerUnavailableError,
    DaynestTimeoutError,
)
from daynest.models import CalendarDay, CalendarEvent, ChoreTemplate, DaynestDashboard, DaynestSummary, PlannedItem, RoutineTemplate

VALID_SUMMARY_PAYLOAD = {
    "sensor_daynest_chores_due": 2,
    "sensor_daynest_routines_open": 1,
    "sensor_daynest_medication_due": 1,
    "sensor_daynest_planned_remaining": 3,
    "sensor_daynest_overdue_count": 1,
    "sensor_daynest_next_medication": "Vitamin D @ 09:00",
}

VALID_DASHBOARD_PAYLOAD = {
    "for_date": "2026-01-15",
    "due_today_count": 3,
    "overdue_count": 1,
    "planned_count": 2,
    "medication_due_count": 1,
    "completion_ratio": 0.5,
    "next_medication": "08:00",
}

VALID_PLANNED_ITEM_PAYLOAD = {
    "id": 10,
    "title": "Plan dinner",
    "planned_for": "2026-01-15",
    "notes": "With rice",
    "module_key": None,
    "recurrence_hint": None,
    "rrule": None,
    "recurrence_series_id": None,
    "linked_source": None,
    "linked_ref": None,
    "priority": "normal",
    "tags": ["food"],
    "is_done": False,
}

CONTRACT_HEADER = "home-assistant; version=ha.v1"


def _make_mock_response(
    status: int,
    json_body: object,
    headers: dict | None = None,
) -> MagicMock:
    response = MagicMock()
    response.status = status
    response.headers = headers if headers is not None else {"X-Integration-Contract": CONTRACT_HEADER}
    response.json = AsyncMock(return_value=json_body)
    response.raise_for_status = MagicMock()
    response.__aenter__ = AsyncMock(return_value=response)
    response.__aexit__ = AsyncMock(return_value=False)
    return response


def _make_client(response: MagicMock) -> DaynestClient:
    session = MagicMock(spec=aiohttp.ClientSession)
    session.get = MagicMock(return_value=response)
    return DaynestClient(
        base_url="https://api.daynest.example",
        integration_key="daynest_test_key",
        session=session,
    )


@pytest.mark.unit
class TestDaynestClientInit:
    """Tests for DaynestClient initialization."""

    def test_raises_when_base_url_empty(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        with pytest.raises(ValueError, match="base URL is required"):
            DaynestClient(base_url="", session=session)

    def test_strips_trailing_slash_from_base_url(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestClient(base_url="https://api.example/", session=session)
        assert client._base_url == "https://api.example"

    def test_password_used_as_fallback_for_integration_key(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestClient(base_url="https://api.example", session=session, password="secret")
        assert client._integration_key == "secret"

    def test_integration_key_takes_priority_over_password(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestClient(
            base_url="https://api.example",
            integration_key="key",
            session=session,
            password="fallback",
        )
        assert client._integration_key == "key"

    def test_has_integration_key_false_when_no_key(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestClient(base_url="https://api.example", session=session)
        assert client.has_integration_key is False

    def test_has_integration_key_true_when_key_set(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)
        assert client.has_integration_key is True

    async def test_context_manager_creates_and_closes_session(self) -> None:
        async with DaynestClient(base_url="https://api.example") as client:
            assert client._session is not None
        assert client._session is None

    async def test_context_manager_does_not_close_caller_session(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        session.close = AsyncMock()
        async with DaynestClient(base_url="https://api.example", session=session) as client:
            assert client._session is session
        session.close.assert_not_called()

    async def test_context_manager_cancels_background_tasks(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        background_task_cancelled = asyncio.Event()

        async def _background_task() -> None:
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                background_task_cancelled.set()
                raise

        async with DaynestClient(base_url="https://api.example", session=session) as client:
            task = asyncio.create_task(_background_task())
            client._background_tasks.add(task)
            await asyncio.sleep(0)

        assert background_task_cancelled.is_set()


@pytest.mark.unit
class TestDaynestClientRequests:
    """Tests for DaynestClient HTTP read methods."""

    async def test_get_summary_returns_typed_response(self) -> None:
        response = _make_mock_response(200, VALID_SUMMARY_PAYLOAD)
        client = _make_client(response)

        result = await client.async_get_summary()

        assert isinstance(result.data, DaynestSummary)
        assert result.integration_contract == CONTRACT_HEADER

    async def test_get_dashboard_returns_typed_response(self) -> None:
        response = _make_mock_response(200, VALID_DASHBOARD_PAYLOAD)
        client = _make_client(response)

        result = await client.async_get_dashboard()

        assert isinstance(result.data, DaynestDashboard)
        assert result.integration_contract == CONTRACT_HEADER

    async def test_401_raises_authentication_error(self) -> None:
        response = _make_mock_response(401, {})
        client = _make_client(response)

        with pytest.raises(DaynestAuthError):
            await client.async_get_summary()

    async def test_403_raises_authentication_error(self) -> None:
        response = _make_mock_response(403, {})
        client = _make_client(response)

        with pytest.raises(DaynestAuthError):
            await client.async_get_summary()

    async def test_404_raises_not_found_error(self) -> None:
        response = _make_mock_response(404, {})
        client = _make_client(response)

        with pytest.raises(DaynestNotFoundError):
            await client.async_get_summary()

    async def test_404_on_dashboard_raises_not_found_error(self) -> None:
        response = _make_mock_response(404, {})
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        with pytest.raises(DaynestNotFoundError):
            await client.async_get_dashboard()

    async def test_500_raises_server_unavailable_error(self) -> None:
        response = _make_mock_response(500, {})
        client = _make_client(response)

        with pytest.raises(DaynestServerUnavailableError):
            await client.async_get_summary()

    async def test_timeout_raises_timeout_error(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=asyncio.TimeoutError)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        session.get = MagicMock(return_value=mock_ctx)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        with pytest.raises(DaynestTimeoutError):
            await client.async_get_summary()

    async def test_connection_error_raises_server_unavailable(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=aiohttp.ClientConnectionError("refused"))
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        session.get = MagicMock(return_value=mock_ctx)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        with pytest.raises(DaynestServerUnavailableError):
            await client.async_get_summary()

    async def test_non_dict_response_raises_malformed_error(self) -> None:
        response = _make_mock_response(200, ["not", "a", "dict"])
        client = _make_client(response)

        with pytest.raises(DaynestMalformedResponseError):
            await client.async_get_summary()

    async def test_summary_missing_keys_raises_malformed_error(self) -> None:
        incomplete = {"todo_daynest_today": 1}
        response = _make_mock_response(200, incomplete)
        client = _make_client(response)

        with pytest.raises(DaynestMalformedResponseError, match="missing required keys"):
            await client.async_get_summary()

    async def test_dashboard_missing_keys_raises_malformed_error(self) -> None:
        incomplete = {"for_date": "2026-01-15", "due_today_count": 1}
        response = _make_mock_response(200, incomplete)
        client = _make_client(response)

        with pytest.raises(DaynestMalformedResponseError, match="missing required keys"):
            await client.async_get_dashboard()

    async def test_no_contract_header_returns_none_contract(self) -> None:
        response = _make_mock_response(200, VALID_SUMMARY_PAYLOAD, headers={})
        client = _make_client(response)

        result = await client.async_get_summary()

        assert result.integration_contract is None

    async def test_integration_key_sent_in_request_header(self) -> None:
        response = _make_mock_response(200, VALID_SUMMARY_PAYLOAD)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=response)
        client = DaynestClient(
            base_url="https://api.example",
            integration_key="daynest_secret",
            session=session,
        )

        await client.async_get_summary()

        call_kwargs = session.get.call_args[1]
        assert call_kwargs["headers"]["X-Integration-Key"] == "daynest_secret"

    async def test_no_key_omits_integration_key_header(self) -> None:
        response = _make_mock_response(200, VALID_SUMMARY_PAYLOAD)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", session=session)

        await client.async_get_summary()

        call_kwargs = session.get.call_args[1]
        assert "X-Integration-Key" not in call_kwargs["headers"]

    async def test_oauth_token_response_builds_bearer_header(self) -> None:
        response = _make_mock_response(200, {"access_token": "access-token", "expires_in": "300"})
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(
            base_url="https://api.example",
            client_id="integration-client",
            client_secret="client-secret",
            token_url="https://auth.example/token",
            session=session,
        )

        assert await client._get_auth_headers() == {"Authorization": "Bearer access-token"}

    async def test_oauth_token_non_object_response_raises_auth_error(self) -> None:
        response = _make_mock_response(200, ["not", "an", "object"])
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(
            base_url="https://api.example",
            client_id="integration-client",
            client_secret="client-secret",
            token_url="https://auth.example/token",
            session=session,
        )

        with pytest.raises(DaynestAuthError, match="malformed payload"):
            await client._get_auth_headers()

    async def test_oauth_token_invalid_expires_in_falls_back_to_default(self) -> None:
        response = _make_mock_response(200, {"access_token": "access-token", "expires_in": "soon"})
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(
            base_url="https://api.example",
            client_id="integration-client",
            client_secret="client-secret",
            token_url="https://auth.example/token",
            session=session,
        )

        assert await client._get_auth_headers() == {"Authorization": "Bearer access-token"}

    async def test_external_access_token_getter_is_used_before_other_auth_modes(self) -> None:
        response = _make_mock_response(200, {"access_token": "ignored-token", "expires_in": "300"})
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(
            base_url="https://api.example",
            integration_key="legacy-key",
            client_id="integration-client",
            client_secret="client-secret",
            token_url="https://auth.example/token",
            access_token_getter=lambda: "oidc-access-token",
            session=session,
        )

        assert await client._get_auth_headers() == {"Authorization": "Bearer oidc-access-token"}
        session.post.assert_not_called()

    async def test_external_access_token_getter_supports_async_callback(self) -> None:
        async def _token() -> str:
            return "async-token"

        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestClient(
            base_url="https://api.example",
            access_token_getter=_token,
            session=session,
        )

        assert await client._get_auth_headers() == {"Authorization": "Bearer async-token"}

    async def test_client_error_raises_communication_error(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=aiohttp.ClientError("generic"))
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        session.get = MagicMock(return_value=mock_ctx)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        with pytest.raises(DaynestCommunicationError):
            await client.async_get_summary()


VALID_ACTION_RESPONSE = {"success": True, "detail": "Task 42 marked as complete"}


def _make_post_client(response: MagicMock) -> DaynestClient:
    session = MagicMock(spec=aiohttp.ClientSession)
    session.post = MagicMock(return_value=response)
    return DaynestClient(
        base_url="https://api.daynest.example",
        integration_key="daynest_write_key",
        session=session,
    )


@pytest.mark.unit
class TestDaynestClientWriteMethods:
    """Tests for DaynestClient write (POST/PUT/DELETE) methods."""

    async def test_complete_task_returns_dict(self) -> None:
        response = _make_mock_response(200, VALID_ACTION_RESPONSE)
        client = _make_post_client(response)

        result = await client.async_complete_task(chore_instance_id=42)

        assert result["success"] is True
        assert "42" in result["detail"]

    async def test_snooze_task_returns_dict(self) -> None:
        snooze_response = {"success": True, "detail": "Task 10 rescheduled by 2 day(s)"}
        response = _make_mock_response(200, snooze_response)
        client = _make_post_client(response)

        result = await client.async_snooze_task(chore_instance_id=10, days=2)

        assert result["success"] is True

    async def test_mark_medication_taken_returns_dict(self) -> None:
        med_response = {"success": True, "detail": "Medication dose 7 marked as taken"}
        response = _make_mock_response(200, med_response)
        client = _make_post_client(response)

        result = await client.async_mark_medication_taken(medication_dose_id=7)

        assert result["success"] is True

    async def test_post_action_401_raises_authentication_error(self) -> None:
        response = _make_mock_response(401, {})
        client = _make_post_client(response)

        with pytest.raises(DaynestAuthError):
            await client.async_complete_task(chore_instance_id=1)

    async def test_post_action_403_raises_authentication_error(self) -> None:
        response = _make_mock_response(403, {})
        client = _make_post_client(response)

        with pytest.raises(DaynestAuthError):
            await client.async_complete_task(chore_instance_id=1)

    async def test_post_action_404_raises_not_found_error(self) -> None:
        response = _make_mock_response(404, {})
        client = _make_post_client(response)

        with pytest.raises(DaynestNotFoundError):
            await client.async_complete_task(chore_instance_id=1)

    async def test_post_action_500_raises_server_unavailable_error(self) -> None:
        response = _make_mock_response(500, {})
        client = _make_post_client(response)

        with pytest.raises(DaynestServerUnavailableError):
            await client.async_complete_task(chore_instance_id=1)

    async def test_post_action_timeout_raises_timeout_error(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=asyncio.TimeoutError)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        session.post = MagicMock(return_value=mock_ctx)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        with pytest.raises(DaynestTimeoutError):
            await client.async_complete_task(chore_instance_id=1)

    async def test_post_action_connection_error_raises_server_unavailable(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=aiohttp.ClientConnectionError("refused"))
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        session.post = MagicMock(return_value=mock_ctx)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        with pytest.raises(DaynestServerUnavailableError):
            await client.async_snooze_task(chore_instance_id=1)

    async def test_post_action_non_dict_response_raises_malformed_error(self) -> None:
        response = _make_mock_response(200, ["not", "a", "dict"])
        client = _make_post_client(response)

        with pytest.raises(DaynestMalformedResponseError):
            await client.async_mark_medication_taken(medication_dose_id=1)

    async def test_post_action_sends_integration_key_header(self) -> None:
        response = _make_mock_response(200, VALID_ACTION_RESPONSE)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(
            base_url="https://api.example",
            integration_key="daynest_write_secret",
            session=session,
        )

        await client.async_complete_task(chore_instance_id=5)

        call_kwargs = session.post.call_args[1]
        assert call_kwargs["headers"]["X-Integration-Key"] == "daynest_write_secret"

    async def test_snooze_task_uses_default_days(self) -> None:
        response = _make_mock_response(200, VALID_ACTION_RESPONSE)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        await client.async_snooze_task(chore_instance_id=3)

        call_kwargs = session.post.call_args[1]
        assert call_kwargs["json"]["days"] == 1

    async def test_complete_task_uses_chore_instance_id_payload(self) -> None:
        response = _make_mock_response(200, VALID_ACTION_RESPONSE)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        await client.async_complete_task(chore_instance_id=6)

        call_kwargs = session.post.call_args[1]
        assert call_kwargs["json"] == {"chore_instance_id": 6}

    async def test_snooze_task_uses_chore_instance_id_payload(self) -> None:
        response = _make_mock_response(200, VALID_ACTION_RESPONSE)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        await client.async_snooze_task(chore_instance_id=7, days=4)

        call_kwargs = session.post.call_args[1]
        assert call_kwargs["json"] == {"chore_instance_id": 7, "days": 4}

    async def test_skip_task_uses_chore_instance_id_payload(self) -> None:
        response = _make_mock_response(200, VALID_ACTION_RESPONSE)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        await client.async_skip_task(chore_instance_id=8)

        call_kwargs = session.post.call_args[1]
        assert call_kwargs["json"] == {"chore_instance_id": 8}

    async def test_skip_medication_uses_medication_dose_id_payload(self) -> None:
        response = _make_mock_response(200, VALID_ACTION_RESPONSE)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        await client.async_skip_medication(medication_dose_id=9)

        call_kwargs = session.post.call_args[1]
        assert call_kwargs["json"] == {"medication_dose_id": 9}

    async def test_create_planned_item_uses_expected_payload(self) -> None:
        response = _make_mock_response(200, VALID_PLANNED_ITEM_PAYLOAD)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.post = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        result = await client.async_create_planned_item(title="Plan dinner", planned_for="2026-01-15", notes="With rice")

        call_kwargs = session.post.call_args[1]
        assert call_kwargs["json"] == {
            "title": "Plan dinner",
            "planned_for": "2026-01-15",
            "notes": "With rice",
            "priority": "normal",
            "tags": [],
            "rrule": None,
        }
        assert isinstance(result, PlannedItem)
        assert result.id == 10
        assert session.post.call_args[0][0].endswith("/api/v1/planned-items")

    async def test_update_planned_item_uses_expected_payload(self) -> None:
        response = _make_mock_response(200, {**VALID_PLANNED_ITEM_PAYLOAD, "is_done": True})
        session = MagicMock(spec=aiohttp.ClientSession)
        session.put = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        result = await client.async_update_planned_item(
            planned_item_id=10,
            title="Plan dinner",
            planned_for="2026-01-16",
            is_done=True,
            notes="With vegetables",
        )

        call_kwargs = session.put.call_args[1]
        assert call_kwargs["json"]["title"] == "Plan dinner"
        assert call_kwargs["json"]["planned_for"] == "2026-01-16"
        assert call_kwargs["json"]["is_done"] is True
        assert isinstance(result, PlannedItem)
        assert session.put.call_args[0][0].endswith("/api/v1/planned-items/10")

    async def test_delete_planned_item_uses_expected_endpoint(self) -> None:
        response = _make_mock_response(204, {})
        session = MagicMock(spec=aiohttp.ClientSession)
        session.delete = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        await client.async_delete_planned_item(planned_item_id=10)

        call_args = session.delete.call_args[0]
        assert call_args[0].endswith("/api/v1/planned-items/10")


VALID_CALENDAR_PAYLOAD = [
    {
        "uid": "chore-1",
        "summary": "Clean kitchen",
        "start": {"date": "2026-05-17"},
        "end": {"date": "2026-05-18"},
    },
    {
        "uid": "med-2",
        "summary": "Vitamin D",
        "start": {"dateTime": "2026-05-17T09:00:00"},
        "end": {"dateTime": "2026-05-17T09:15:00"},
        "description": "Take with food",
    },
]


def _make_list_client(response: MagicMock) -> DaynestClient:
    session = MagicMock(spec=aiohttp.ClientSession)
    session.get = MagicMock(return_value=response)
    return DaynestClient(
        base_url="https://api.daynest.example",
        integration_key="daynest_read_key",
        session=session,
    )


@pytest.mark.unit
class TestDaynestClientCalendarMethods:
    """Tests for async_get_calendar / _request_list."""

    async def test_get_calendar_returns_list_of_dicts(self) -> None:
        response = _make_mock_response(200, VALID_CALENDAR_PAYLOAD)
        client = _make_list_client(response)

        result = await client.async_get_calendar(date(2026, 5, 17), date(2026, 5, 31))

        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]["uid"] == "chore-1"

    async def test_get_calendar_url_includes_date_params(self) -> None:
        response = _make_mock_response(200, VALID_CALENDAR_PAYLOAD)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        await client.async_get_calendar(date(2026, 5, 1), date(2026, 5, 31))

        call_args = session.get.call_args[0]
        assert "start=2026-05-01" in call_args[0]
        assert "end=2026-05-31" in call_args[0]

    async def test_non_list_response_raises_malformed_error(self) -> None:
        response = _make_mock_response(200, {"not": "a list"})
        client = _make_list_client(response)

        with pytest.raises(DaynestMalformedResponseError, match="expected JSON array"):
            await client.async_get_calendar(date(2026, 5, 1), date(2026, 5, 31))

    async def test_non_dict_items_filtered_out(self) -> None:
        mixed_payload = [VALID_CALENDAR_PAYLOAD[0], "not a dict", 42, VALID_CALENDAR_PAYLOAD[1]]
        response = _make_mock_response(200, mixed_payload)
        client = _make_list_client(response)

        result = await client.async_get_calendar(date(2026, 5, 1), date(2026, 5, 31))

        assert len(result) == 2

    async def test_calendar_401_raises_authentication_error(self) -> None:
        response = _make_mock_response(401, {})
        client = _make_list_client(response)

        with pytest.raises(DaynestAuthError):
            await client.async_get_calendar(date(2026, 5, 1), date(2026, 5, 31))

    async def test_calendar_404_raises_not_found_error(self) -> None:
        response = _make_mock_response(404, {})
        client = _make_list_client(response)

        with pytest.raises(DaynestNotFoundError):
            await client.async_get_calendar(date(2026, 5, 1), date(2026, 5, 31))

    async def test_calendar_500_raises_server_unavailable_error(self) -> None:
        response = _make_mock_response(500, {})
        client = _make_list_client(response)

        with pytest.raises(DaynestServerUnavailableError):
            await client.async_get_calendar(date(2026, 5, 1), date(2026, 5, 31))

    async def test_calendar_timeout_raises_timeout_error(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=asyncio.TimeoutError)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        session.get = MagicMock(return_value=mock_ctx)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        with pytest.raises(DaynestTimeoutError):
            await client.async_get_calendar(date(2026, 5, 1), date(2026, 5, 31))

    async def test_calendar_empty_list_returned(self) -> None:
        response = _make_mock_response(200, [])
        client = _make_list_client(response)

        result = await client.async_get_calendar(date(2026, 5, 1), date(2026, 5, 31))

        assert result == []


@pytest.mark.unit
class TestDaynestClientTypedMethods:
    async def test_list_planned_items_returns_typed_items(self) -> None:
        response = _make_mock_response(200, [VALID_PLANNED_ITEM_PAYLOAD])
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        result = await client.async_list_planned_items(date(2026, 1, 1), date(2026, 1, 31))

        assert len(result) == 1
        assert isinstance(result[0], PlannedItem)
        assert "start_date=2026-01-01" in session.get.call_args[0][0]

    async def test_routine_template_methods_return_typed_models(self) -> None:
        routine_payload = {
            "id": 1,
            "name": "Morning routine",
            "description": None,
            "start_date": "2026-01-01",
            "every_n_days": 1,
            "rrule": None,
            "due_time": "08:00:00",
            "is_active": True,
            "created_at": "2026-01-01T00:00:00",
        }
        list_response = _make_mock_response(200, [routine_payload])
        create_response = _make_mock_response(200, routine_payload)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=list_response)
        session.post = MagicMock(return_value=create_response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        listed = await client.async_list_routine_templates()
        created = await client.async_create_routine_template("Morning routine", 1, date(2026, 1, 1))

        assert isinstance(listed[0], RoutineTemplate)
        assert isinstance(created, RoutineTemplate)

    async def test_chore_template_methods_return_typed_models(self) -> None:
        chore_payload = {
            "id": 2,
            "name": "Clean kitchen",
            "description": None,
            "start_date": "2026-01-01",
            "every_n_days": 2,
            "rrule": None,
            "priority": "normal",
            "tags": ["home"],
            "is_active": True,
            "created_at": "2026-01-01T00:00:00",
        }
        list_response = _make_mock_response(200, [chore_payload])
        create_response = _make_mock_response(200, chore_payload)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=list_response)
        session.post = MagicMock(return_value=create_response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        listed = await client.async_list_chore_templates()
        created = await client.async_create_chore_template("Clean kitchen", 2, date(2026, 1, 1))

        assert isinstance(listed[0], ChoreTemplate)
        assert isinstance(created, ChoreTemplate)

    async def test_calendar_day_month_and_export_methods(self) -> None:
        month_response = _make_mock_response(
            200,
            {"year": 2026, "month": 1, "days": [{"date": "2026-01-01", "total": 1, "routines": 0, "chores": 1, "medications": 0, "planned": 0}]},
        )
        day_response = _make_mock_response(
            200,
            {"date": "2026-01-01", "items": [{"item_type": "chore", "item_id": 1, "title": "Clean", "status": "pending"}]},
        )
        ics_response = _make_mock_response(200, {})
        ics_response.read = AsyncMock(return_value=b"BEGIN:VCALENDAR")
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(side_effect=[month_response, day_response, ics_response])
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        month = await client.async_get_calendar_month(2026, 1)
        day = await client.async_get_calendar_day(date(2026, 1, 1))
        exported = await client.async_export_calendar_ics()

        assert isinstance(month[0], CalendarDay)
        assert isinstance(day, CalendarDay)
        assert exported.startswith(b"BEGIN:VCALENDAR")

    async def test_calendar_range_returns_typed_events(self) -> None:
        first_day_response = _make_mock_response(
            200,
            {"date": "2026-01-01", "items": [{"item_type": "chore", "item_id": 1, "title": "Clean"}]},
        )
        second_day_response = _make_mock_response(
            200,
            {"date": "2026-01-02", "items": [{"item_type": "planned", "item_id": 2, "title": "Dinner"}]},
        )
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(side_effect=[first_day_response, second_day_response])
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session)

        events = await client.async_get_calendar_range(date(2026, 1, 1), date(2026, 1, 2))

        assert [event.title for event in events] == ["Clean", "Dinner"]
        assert all(isinstance(event, CalendarEvent) for event in events)


@pytest.mark.unit
class TestDaynestClientCacheAndSSE:
    async def test_cache_hit_returns_cached_value(self) -> None:
        response = _make_mock_response(200, VALID_SUMMARY_PAYLOAD)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session, cache_ttl=30)

        await client.async_get_summary()
        await client.async_get_summary()

        assert session.get.call_count == 1

    async def test_mutation_clears_cache(self) -> None:
        summary_response = _make_mock_response(200, VALID_SUMMARY_PAYLOAD)
        write_response = _make_mock_response(200, VALID_ACTION_RESPONSE)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=summary_response)
        session.post = MagicMock(return_value=write_response)
        client = DaynestClient(base_url="https://api.example", integration_key="key", session=session, cache_ttl=30)

        await client.async_get_summary()
        await client.async_complete_task(1)
        await client.async_get_summary()

        assert session.get.call_count == 2

    def test_cache_key_includes_auth_context(self) -> None:
        authenticated_client = DaynestClient(base_url="https://api.example", integration_key="key", session=MagicMock())
        anonymous_client = DaynestClient(base_url="https://api.example", session=MagicMock())

        assert authenticated_client._make_cache_key("async_get_summary", ()) != anonymous_client._make_cache_key(
            "async_get_summary",
            (),
        )

    async def test_sse_listener_passes_event_type_and_payload(self) -> None:
        class _Stream:
            def __aiter__(self):
                async def _gen():
                    yield b"event: ping\n"
                    yield b"data: {\"alive\": true}\n"
                    yield b"\n"
                return _gen()

        response = _make_mock_response(200, {})
        response.content = _Stream()
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=response)
        callback_called = asyncio.Event()
        callback = AsyncMock(side_effect=lambda _event, _payload: callback_called.set())
        client = DaynestClient(base_url="https://api.example", integration_key="token", session=session)

        unsubscribe = await client.async_listen(callback)
        try:
            await asyncio.wait_for(callback_called.wait(), timeout=1)
        finally:
            unsubscribe()

        callback.assert_awaited_with("ping", {"alive": True})

    async def test_sse_listener_calls_callback(self) -> None:
        class _Stream:
            def __init__(self, lines: list[bytes]) -> None:
                self._lines = lines

            def __aiter__(self):
                async def _gen():
                    for line in self._lines:
                        yield line
                return _gen()

        response = _make_mock_response(200, {})
        response.content = _Stream([b"event: today_updated\n", b"data: {\"ping\": true}\n", b"\n"])
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=response)
        callback_called = asyncio.Event()
        callback = AsyncMock(side_effect=lambda _payload: callback_called.set())
        client = DaynestClient(base_url="https://api.example", integration_key="token", session=session)

        unsubscribe = await client.async_subscribe_today_updates(callback)
        try:
            await asyncio.wait_for(callback_called.wait(), timeout=1)
        finally:
            unsubscribe()

        callback.assert_awaited()

    async def test_sse_listener_exits_without_authentication(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        callback = AsyncMock()
        client = DaynestClient(base_url="https://api.example", session=session)

        unsubscribe = await client.async_subscribe_today_updates(callback)
        try:
            task = next(iter(client._background_tasks))
            await asyncio.wait_for(task, timeout=1)
        finally:
            unsubscribe()

        session.get.assert_not_called()
        callback.assert_not_awaited()
