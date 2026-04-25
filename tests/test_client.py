"""Unit tests for custom_components.daynest.api.client."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import pytest

from custom_components.daynest.api.client import (
    DaynestApiClient,
    DaynestApiClientAuthenticationError,
    DaynestApiClientCommunicationError,
    DaynestApiClientMalformedResponseError,
    DaynestApiClientServerUnavailableError,
    DaynestApiClientTimeoutError,
    DaynestDashboard,
    DaynestSummary,
)

VALID_SUMMARY_PAYLOAD = {
    "todo_daynest_today": 3,
    "sensor_daynest_overdue_count": 1,
    "sensor_daynest_next_medication": "08:00",
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

CONTRACT_HEADER = "home-assistant; version=ha.v1"


def _make_mock_response(
    status: int,
    json_body: object,
    headers: dict | None = None,
) -> MagicMock:
    response = MagicMock()
    response.status = status
    response.headers = headers or {"X-Integration-Contract": CONTRACT_HEADER}
    response.json = AsyncMock(return_value=json_body)
    response.raise_for_status = MagicMock()
    response.__aenter__ = AsyncMock(return_value=response)
    response.__aexit__ = AsyncMock(return_value=False)
    return response


def _make_client(response: MagicMock) -> DaynestApiClient:
    session = MagicMock(spec=aiohttp.ClientSession)
    session.get = MagicMock(return_value=response)
    return DaynestApiClient(
        session=session,
        base_url="https://api.daynest.example",
        integration_key="daynest_test_key",
    )


@pytest.mark.unit
class TestDaynestApiClientInit:
    """Tests for DaynestApiClient initialization."""

    def test_raises_when_base_url_empty(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        with pytest.raises(ValueError, match="base URL is required"):
            DaynestApiClient(session=session, base_url="")

    def test_strips_trailing_slash_from_base_url(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestApiClient(session=session, base_url="https://api.example/")
        assert client._base_url == "https://api.example"

    def test_password_used_as_fallback_for_integration_key(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestApiClient(session=session, base_url="https://api.example", password="secret")
        assert client._integration_key == "secret"

    def test_integration_key_takes_priority_over_password(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestApiClient(
            session=session,
            base_url="https://api.example",
            integration_key="key",
            password="fallback",
        )
        assert client._integration_key == "key"

    def test_has_integration_key_false_when_no_key(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestApiClient(session=session, base_url="https://api.example")
        assert client.has_integration_key is False

    def test_has_integration_key_true_when_key_set(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        client = DaynestApiClient(session=session, base_url="https://api.example", integration_key="key")
        assert client.has_integration_key is True


@pytest.mark.unit
class TestDaynestApiClientRequests:
    """Tests for DaynestApiClient HTTP methods."""

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

        with pytest.raises(DaynestApiClientAuthenticationError):
            await client.async_get_summary()

    async def test_403_raises_authentication_error(self) -> None:
        response = _make_mock_response(403, {})
        client = _make_client(response)

        with pytest.raises(DaynestApiClientAuthenticationError):
            await client.async_get_summary()

    async def test_500_raises_server_unavailable_error(self) -> None:
        response = _make_mock_response(500, {})
        client = _make_client(response)

        with pytest.raises(DaynestApiClientServerUnavailableError):
            await client.async_get_summary()

    async def test_timeout_raises_timeout_error(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=asyncio.TimeoutError)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        session.get = MagicMock(return_value=mock_ctx)
        client = DaynestApiClient(session=session, base_url="https://api.example", integration_key="key")

        with pytest.raises(DaynestApiClientTimeoutError):
            await client.async_get_summary()

    async def test_connection_error_raises_server_unavailable(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=aiohttp.ClientConnectionError("refused"))
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        session.get = MagicMock(return_value=mock_ctx)
        client = DaynestApiClient(session=session, base_url="https://api.example", integration_key="key")

        with pytest.raises(DaynestApiClientServerUnavailableError):
            await client.async_get_summary()

    async def test_non_dict_response_raises_malformed_error(self) -> None:
        response = _make_mock_response(200, ["not", "a", "dict"])
        client = _make_client(response)

        with pytest.raises(DaynestApiClientMalformedResponseError):
            await client.async_get_summary()

    async def test_summary_missing_keys_raises_malformed_error(self) -> None:
        incomplete = {"todo_daynest_today": 1}
        response = _make_mock_response(200, incomplete)
        client = _make_client(response)

        with pytest.raises(DaynestApiClientMalformedResponseError, match="missing required keys"):
            await client.async_get_summary()

    async def test_dashboard_missing_keys_raises_malformed_error(self) -> None:
        incomplete = {"for_date": "2026-01-15", "due_today_count": 1}
        response = _make_mock_response(200, incomplete)
        client = _make_client(response)

        with pytest.raises(DaynestApiClientMalformedResponseError, match="missing required keys"):
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
        client = DaynestApiClient(
            session=session,
            base_url="https://api.example",
            integration_key="daynest_secret",
        )

        await client.async_get_summary()

        call_kwargs = session.get.call_args[1]
        assert call_kwargs["headers"]["X-Integration-Key"] == "daynest_secret"

    async def test_no_key_omits_integration_key_header(self) -> None:
        response = _make_mock_response(200, VALID_SUMMARY_PAYLOAD)
        session = MagicMock(spec=aiohttp.ClientSession)
        session.get = MagicMock(return_value=response)
        client = DaynestApiClient(session=session, base_url="https://api.example")

        await client.async_get_summary()

        call_kwargs = session.get.call_args[1]
        assert "X-Integration-Key" not in call_kwargs["headers"]

    async def test_client_error_raises_communication_error(self) -> None:
        session = MagicMock(spec=aiohttp.ClientSession)
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=aiohttp.ClientError("generic"))
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        session.get = MagicMock(return_value=mock_ctx)
        client = DaynestApiClient(session=session, base_url="https://api.example", integration_key="key")

        with pytest.raises(DaynestApiClientCommunicationError):
            await client.async_get_summary()
