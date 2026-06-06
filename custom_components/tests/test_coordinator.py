"""Unit tests for custom_components.daynest.coordinator."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from daynest.models import DaynestDashboard
import pytest

from custom_components.daynest.coordinator import DaynestDataUpdateCoordinator, _safe_float, _safe_int
from daynest import DaynestAuthError, DaynestCommunicationError, DaynestError, DaynestMalformedResponseError
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import UpdateFailed

CONTRACT_VALID = "ha.v1"
CONTRACT_VALID_V2 = "ha.v2"
CONTRACT_UNSUPPORTED = "ha.v99"

VALID_DASHBOARD_PAYLOAD = {
    "for_date": "2026-01-15",
    "due_today_count": 3,
    "overdue_count": 1,
    "planned_count": 2,
    "planned_remaining_count": 2,
    "medication_due_count": 1,
    "completion_ratio": 0.5,
    "next_medication": "08:00",
    "routines_open_count": 1,
    "due_today": [{"chore_instance_id": 1, "title": "Task A", "status": "pending"}],
    "planned": [{"id": 2, "title": "Task B", "is_done": False}],
    "chores": [{"chore_instance_id": 1, "title": "Task A", "status": "pending", "scheduled_date": "2026-01-15"}],
    "medications": [{"medication_dose_instance_id": 4, "name": "Vitamin D", "status": "scheduled", "scheduled_at": "2026-01-15T08:00:00+00:00"}],
    "planned_items": [{"id": 2, "title": "Task B", "is_done": False}],
}


def _make_dashboard_response(payload: dict | None = None, contract: str | None = "home-assistant; version=ha.v1") -> MagicMock:
    response = MagicMock()
    response.integration_contract = contract
    response.data = DaynestDashboard.from_dict(payload or VALID_DASHBOARD_PAYLOAD)
    return response


def _make_coordinator(client: AsyncMock | None = None) -> DaynestDataUpdateCoordinator:
    hass = MagicMock()
    hass.data = {}
    config_entry = MagicMock()
    config_entry.entry_id = "test_entry_id"
    config_entry.domain = "daynest"
    if client is None:
        client = AsyncMock()
    return DaynestDataUpdateCoordinator(hass=hass, config_entry=config_entry, client=client)


@pytest.mark.unit
class TestSafeInt:
    """Tests for the _safe_int helper."""

    def test_integer_value_returned_as_int(self) -> None:
        assert _safe_int(5) == 5

    def test_string_integer_converted(self) -> None:
        assert _safe_int("10") == 10

    def test_float_truncated_to_int(self) -> None:
        assert _safe_int(3.9) == 3

    def test_none_returns_default(self) -> None:
        assert _safe_int(None) == 0

    def test_none_returns_custom_default(self) -> None:
        assert _safe_int(None, default=99) == 99

    def test_non_numeric_string_returns_default(self) -> None:
        assert _safe_int("not-a-number") == 0

    def test_empty_string_returns_default(self) -> None:
        assert _safe_int("") == 0


@pytest.mark.unit
class TestSafeFloat:
    """Tests for the _safe_float helper."""

    def test_float_value_returned(self) -> None:
        assert _safe_float(0.75) == 0.75

    def test_integer_converted_to_float(self) -> None:
        assert _safe_float(1) == 1.0

    def test_string_float_converted(self) -> None:
        assert _safe_float("0.5") == 0.5

    def test_none_returns_default(self) -> None:
        assert _safe_float(None) == 0.0

    def test_none_returns_custom_default(self) -> None:
        assert _safe_float(None, default=1.5) == 1.5

    def test_non_numeric_string_returns_default(self) -> None:
        assert _safe_float("not-a-number") == 0.0

    def test_empty_string_returns_default(self) -> None:
        assert _safe_float("") == 0.0


@pytest.mark.unit
class TestNormalizeDashboard:
    """Tests for DaynestDataUpdateCoordinator._normalize_dashboard."""

    def test_valid_payload_maps_all_keys(self) -> None:
        coordinator = _make_coordinator()
        result = coordinator._normalize_dashboard(VALID_DASHBOARD_PAYLOAD, CONTRACT_VALID)
        assert result["for_date"] == "2026-01-15"
        assert result["due_today_count"] == 3
        assert result["overdue_count"] == 1
        assert result["planned_count"] == 2
        assert result["planned_remaining_count"] == 2
        assert result["medication_due_count"] == 1
        assert result["completion_ratio"] == 0.5
        assert result["next_medication"] == "08:00"
        assert result["routines_open_count"] == 1
        assert result["due_today"] == [{"chore_instance_id": 1, "title": "Task A", "status": "pending"}]
        assert result["planned"] == [{"id": 2, "title": "Task B", "is_done": False}]
        assert result["chores"] == VALID_DASHBOARD_PAYLOAD["chores"]
        assert result["medications"] == VALID_DASHBOARD_PAYLOAD["medications"]
        assert result["planned_items"] == VALID_DASHBOARD_PAYLOAD["planned_items"]
        assert result["integration_contract"] == CONTRACT_VALID

    def test_planned_remaining_count_negative_clamped_to_zero(self) -> None:
        coordinator = _make_coordinator()
        payload = {**VALID_DASHBOARD_PAYLOAD, "planned_remaining_count": -3}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["planned_remaining_count"] == 0

    def test_routines_open_count_negative_clamped_to_zero(self) -> None:
        coordinator = _make_coordinator()
        payload = {**VALID_DASHBOARD_PAYLOAD, "routines_open_count": -1}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["routines_open_count"] == 0

    def test_missing_planned_remaining_defaults_to_zero(self) -> None:
        coordinator = _make_coordinator()
        payload = {k: v for k, v in VALID_DASHBOARD_PAYLOAD.items() if k != "planned_remaining_count"}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["planned_remaining_count"] == 0

    def test_invalid_due_today_and_planned_default_to_empty_lists(self) -> None:
        coordinator = _make_coordinator()
        payload = {**VALID_DASHBOARD_PAYLOAD, "due_today": "invalid", "planned": None}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["due_today"] == []
        assert result["planned"] == []

    def test_negative_counts_clamped_to_zero(self) -> None:
        coordinator = _make_coordinator()
        payload = {**VALID_DASHBOARD_PAYLOAD, "due_today_count": -5, "overdue_count": -1}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["due_today_count"] == 0
        assert result["overdue_count"] == 0

    def test_completion_ratio_clamped_above_one(self) -> None:
        coordinator = _make_coordinator()
        payload = {**VALID_DASHBOARD_PAYLOAD, "completion_ratio": 1.5}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["completion_ratio"] == 1.0

    def test_completion_ratio_clamped_below_zero(self) -> None:
        coordinator = _make_coordinator()
        payload = {**VALID_DASHBOARD_PAYLOAD, "completion_ratio": -0.1}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["completion_ratio"] == 0.0

    def test_invalid_completion_ratio_defaults_to_zero(self) -> None:
        coordinator = _make_coordinator()
        payload = {**VALID_DASHBOARD_PAYLOAD, "completion_ratio": "not-a-float"}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["completion_ratio"] == 0.0

    def test_next_medication_as_dict_preserved(self) -> None:
        coordinator = _make_coordinator()
        med_dict = {"time": "08:00", "name": "Vitamin D"}
        payload = {**VALID_DASHBOARD_PAYLOAD, "next_medication": med_dict}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["next_medication"] == med_dict

    def test_next_medication_none_preserved_as_none(self) -> None:
        coordinator = _make_coordinator()
        payload = {**VALID_DASHBOARD_PAYLOAD, "next_medication": None}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["next_medication"] is None

    def test_next_medication_unexpected_type_converted_to_string(self) -> None:
        coordinator = _make_coordinator()
        payload = {**VALID_DASHBOARD_PAYLOAD, "next_medication": 12345}
        result = coordinator._normalize_dashboard(payload, CONTRACT_VALID)
        assert result["next_medication"] == "12345"

    def test_contract_none_stored_as_none(self) -> None:
        coordinator = _make_coordinator()
        result = coordinator._normalize_dashboard(VALID_DASHBOARD_PAYLOAD, None)
        assert result["integration_contract"] is None


@pytest.mark.unit
class TestAsyncUpdateData:
    """Tests for DaynestDataUpdateCoordinator._async_update_data."""

    async def test_successful_refresh_returns_normalized_data(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.return_value = _make_dashboard_response()
        client.async_get_user_settings.return_value = {
            "default_snooze_days": 4,
            "medication_reminder_minutes": 20,
        }
        client.async_list_shopping_lists.return_value = [
            {"id": 10, "name": "Groceries", "status": "active"},
        ]
        client.async_list_shopping_items.return_value = [
            {"id": 20, "title": "Milk", "is_done": False},
        ]
        coordinator = _make_coordinator(client)
        result = await coordinator._async_update_data()
        assert result["due_today_count"] == 3
        assert result["overdue_count"] == 1
        assert result["integration_contract"] == CONTRACT_VALID
        assert result["default_snooze_days"] == 4
        assert result["medication_reminder_minutes"] == 20
        assert result["shopping_lists"] == [{"id": 10, "name": "Groceries", "status": "active"}]
        assert result["shopping_items"] == {10: [{"id": 20, "title": "Milk", "is_done": False}]}
        client.async_list_shopping_lists.assert_awaited_once_with(status="active")
        client.async_list_shopping_items.assert_awaited_once_with(10)

    async def test_authentication_error_raises_config_entry_auth_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.side_effect = DaynestAuthError()
        coordinator = _make_coordinator(client)
        with pytest.raises(ConfigEntryAuthFailed):
            await coordinator._async_update_data()

    async def test_communication_error_raises_update_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.side_effect = DaynestCommunicationError("timeout")
        coordinator = _make_coordinator(client)
        with pytest.raises(UpdateFailed, match="Temporary communication failure"):
            await coordinator._async_update_data()

    async def test_malformed_response_raises_update_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.side_effect = DaynestMalformedResponseError("bad data")
        coordinator = _make_coordinator(client)
        with pytest.raises(UpdateFailed, match="Malformed dashboard response"):
            await coordinator._async_update_data()

    async def test_generic_api_error_raises_update_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.side_effect = DaynestError("unknown")
        coordinator = _make_coordinator(client)
        with pytest.raises(UpdateFailed, match="Unexpected API error"):
            await coordinator._async_update_data()

    async def test_v2_contract_accepted(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.return_value = _make_dashboard_response(
            contract="home-assistant; version=ha.v2"
        )
        client.async_get_user_settings.return_value = {}
        coordinator = _make_coordinator(client)
        result = await coordinator._async_update_data()
        assert result["integration_contract"] == CONTRACT_VALID_V2

    async def test_transition_events_fire_when_states_change(self) -> None:
        client = AsyncMock()
        first_payload = {
            **VALID_DASHBOARD_PAYLOAD,
            "for_date": "2026-01-15",
            "completion_ratio": 0.5,
            "chores": [{"chore_instance_id": 11, "status": "pending", "scheduled_date": "2026-01-15"}],
            "medications": [{"medication_dose_instance_id": 21, "status": "scheduled", "scheduled_at": "2026-01-15T08:00:00+00:00"}],
        }
        second_payload = {
            **VALID_DASHBOARD_PAYLOAD,
            "for_date": "2026-01-16",
            "completion_ratio": 1.0,
            "chores": [{"chore_instance_id": 11, "status": "pending", "scheduled_date": "2026-01-15"}],
            "medications": [{"medication_dose_instance_id": 21, "status": "missed", "scheduled_at": "2026-01-15T08:00:00+00:00"}],
        }
        client.async_get_dashboard.side_effect = [
            _make_dashboard_response(first_payload),
            _make_dashboard_response(second_payload),
        ]
        client.async_get_user_settings.return_value = {}
        coordinator = _make_coordinator(client)
        coordinator.hass.bus.async_fire = MagicMock()

        await coordinator._async_update_data()
        await coordinator._async_update_data()

        coordinator.hass.bus.async_fire.assert_any_call("daynest_chore_overdue", {"chore_instance_id": 11})
        coordinator.hass.bus.async_fire.assert_any_call(
            "daynest_medication_missed",
            {"medication_dose_instance_id": 21},
        )
        coordinator.hass.bus.async_fire.assert_any_call("daynest_day_complete", {"for_date": "2026-01-16"})

    async def test_unsupported_contract_raises_update_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.return_value = _make_dashboard_response(
            contract="home-assistant; version=ha.v99"
        )
        coordinator = _make_coordinator(client)
        with pytest.raises(UpdateFailed, match="Unsupported or missing integration contract"):
            await coordinator._async_update_data()

    async def test_missing_contract_header_raises_update_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.return_value = _make_dashboard_response(contract=None)
        coordinator = _make_coordinator(client)
        with pytest.raises(UpdateFailed, match="Unsupported or missing integration contract"):
            await coordinator._async_update_data()


@pytest.mark.unit
class TestSseRefresh:
    async def test_start_sse_refreshes_for_today_updates_and_stops(self) -> None:
        client = AsyncMock()
        unsubscribe = MagicMock()
        client.async_subscribe_today_updates.return_value = unsubscribe
        coordinator = _make_coordinator(client)
        coordinator.async_request_refresh = AsyncMock()

        await coordinator.async_start_sse()
        callback = client.async_subscribe_today_updates.await_args.args[0]
        await callback({"reason": "changed"})
        coordinator.async_stop_sse()

        coordinator.async_request_refresh.assert_awaited_once()
        unsubscribe.assert_called_once()
