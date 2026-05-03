"""Unit tests for custom_components.daynest.coordinator."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from daynest.api.client import (
    DaynestApiClientAuthenticationError,
    DaynestApiClientCommunicationError,
    DaynestApiClientError,
    DaynestApiClientMalformedResponseError,
    DaynestDashboard,
)
from daynest.coordinator import DaynestDataUpdateCoordinator, _safe_float, _safe_int
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import UpdateFailed

CONTRACT_VALID = "ha.v1"
CONTRACT_UNSUPPORTED = "ha.v99"

VALID_DASHBOARD_PAYLOAD = {
    "for_date": "2026-01-15",
    "due_today_count": 3,
    "overdue_count": 1,
    "planned_count": 2,
    "medication_due_count": 1,
    "completion_ratio": 0.5,
    "next_medication": "08:00",
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
        assert result["medication_due_count"] == 1
        assert result["completion_ratio"] == 0.5
        assert result["next_medication"] == "08:00"
        assert result["integration_contract"] == CONTRACT_VALID

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
        coordinator = _make_coordinator(client)
        result = await coordinator._async_update_data()
        assert result["due_today_count"] == 3
        assert result["overdue_count"] == 1
        assert result["integration_contract"] == CONTRACT_VALID

    async def test_authentication_error_raises_config_entry_auth_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.side_effect = DaynestApiClientAuthenticationError()
        coordinator = _make_coordinator(client)
        with pytest.raises(ConfigEntryAuthFailed):
            await coordinator._async_update_data()

    async def test_communication_error_raises_update_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.side_effect = DaynestApiClientCommunicationError("timeout")
        coordinator = _make_coordinator(client)
        with pytest.raises(UpdateFailed, match="Temporary communication failure"):
            await coordinator._async_update_data()

    async def test_malformed_response_raises_update_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.side_effect = DaynestApiClientMalformedResponseError("bad data")
        coordinator = _make_coordinator(client)
        with pytest.raises(UpdateFailed, match="Malformed dashboard response"):
            await coordinator._async_update_data()

    async def test_generic_api_error_raises_update_failed(self) -> None:
        client = AsyncMock()
        client.async_get_dashboard.side_effect = DaynestApiClientError("unknown")
        coordinator = _make_coordinator(client)
        with pytest.raises(UpdateFailed, match="Unexpected API error"):
            await coordinator._async_update_data()

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
