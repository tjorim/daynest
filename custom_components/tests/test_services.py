"""Unit tests for custom_components.daynest.services."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from daynest.api.client import (
    DaynestApiClientAuthenticationError,
    DaynestApiClientCommunicationError,
    DaynestApiClientError,
)
from daynest.services import (
    ATTR_DAYS,
    ATTR_MEDICATION_DOSE_ID,
    ATTR_TASK_ID,
    SERVICE_COMPLETE_TASK,
    SERVICE_MARK_MEDICATION_TAKEN,
    SERVICE_REFRESH,
    SERVICE_SNOOZE_TASK,
    async_setup_services,
    async_unload_services,
)
from homeassistant.exceptions import HomeAssistantError


def _make_entry(client: MagicMock | None = None, entry_id: str = "test_entry") -> MagicMock:
    entry = MagicMock()
    entry.entry_id = entry_id
    entry.runtime_data.client = client or AsyncMock()
    entry.runtime_data.coordinator.async_refresh = AsyncMock()
    return entry


def _make_hass(entries: list[MagicMock] | None = None) -> MagicMock:
    hass = MagicMock()
    hass.config_entries.async_entries = MagicMock(return_value=entries or [])
    registered: dict[str, object] = {}

    def mock_async_register(domain, service, handler, schema=None):
        registered[service] = handler

    def mock_async_remove(domain, service):
        registered.pop(service, None)

    hass.services.async_register = mock_async_register
    hass.services.async_remove = mock_async_remove
    hass._registered_services = registered
    return hass


async def _get_handler(hass: MagicMock, service: str) -> object:
    return hass._registered_services[service]


def _make_service_call(**data) -> MagicMock:
    call_obj = MagicMock()
    call_obj.data = data
    return call_obj


@pytest.mark.unit
@pytest.mark.asyncio
class TestAsyncSetupServices:
    """Tests for async_setup_services service registration."""

    async def test_registers_all_four_services(self) -> None:
        hass = _make_hass()
        await async_setup_services(hass)
        assert SERVICE_REFRESH in hass._registered_services
        assert SERVICE_COMPLETE_TASK in hass._registered_services
        assert SERVICE_SNOOZE_TASK in hass._registered_services
        assert SERVICE_MARK_MEDICATION_TAKEN in hass._registered_services

    async def test_unload_removes_all_services(self) -> None:
        hass = _make_hass()
        await async_setup_services(hass)
        async_unload_services(hass)
        assert SERVICE_REFRESH not in hass._registered_services
        assert SERVICE_COMPLETE_TASK not in hass._registered_services
        assert SERVICE_SNOOZE_TASK not in hass._registered_services
        assert SERVICE_MARK_MEDICATION_TAKEN not in hass._registered_services


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleRefresh:
    """Tests for the refresh service handler."""

    async def test_no_entries_logs_warning_and_returns(self) -> None:
        hass = _make_hass(entries=[])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_REFRESH)
        service_call = _make_service_call()
        with patch("daynest.services.LOGGER") as mock_logger:
            await handler(service_call)
        mock_logger.warning.assert_called_once()

    async def test_single_entry_triggers_coordinator_refresh(self) -> None:
        entry = _make_entry()
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_REFRESH)
        await handler(_make_service_call())
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_multiple_entries_all_refreshed(self) -> None:
        entries = [_make_entry(entry_id="e1"), _make_entry(entry_id="e2")]
        hass = _make_hass(entries=entries)
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_REFRESH)
        await handler(_make_service_call())
        for entry in entries:
            entry.runtime_data.coordinator.async_refresh.assert_awaited_once()


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleCompleteTask:
    """Tests for the complete_task service handler."""

    async def test_no_entries_logs_warning_and_returns(self) -> None:
        hass = _make_hass(entries=[])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with patch("daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_TASK_ID: 42}))
        mock_logger.warning.assert_called_once()

    async def test_multiple_entries_logs_warning_and_returns(self) -> None:
        entries = [_make_entry(entry_id="e1"), _make_entry(entry_id="e2")]
        hass = _make_hass(entries=entries)
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with patch("daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_TASK_ID: 42}))
        mock_logger.warning.assert_called_once()
        for entry in entries:
            entry.runtime_data.client.async_complete_task.assert_not_awaited()

    async def test_success_calls_client_and_refreshes_coordinator(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        await handler(_make_service_call(**{ATTR_TASK_ID: 7}))
        client.async_complete_task.assert_awaited_once_with(task_id=7)
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_authentication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_complete_task.side_effect = DaynestApiClientAuthenticationError()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with pytest.raises(HomeAssistantError, match="Authentication error completing task"):
            await handler(_make_service_call(**{ATTR_TASK_ID: 7}))

    async def test_communication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_complete_task.side_effect = DaynestApiClientCommunicationError("network down")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with pytest.raises(HomeAssistantError, match="Communication error completing task"):
            await handler(_make_service_call(**{ATTR_TASK_ID: 7}))

    async def test_generic_api_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_complete_task.side_effect = DaynestApiClientError("generic")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with pytest.raises(HomeAssistantError, match="Error completing task"):
            await handler(_make_service_call(**{ATTR_TASK_ID: 7}))

    async def test_error_does_not_trigger_coordinator_refresh(self) -> None:
        client = AsyncMock()
        client.async_complete_task.side_effect = DaynestApiClientError("fail")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with pytest.raises(HomeAssistantError):
            await handler(_make_service_call(**{ATTR_TASK_ID: 7}))
        entry.runtime_data.coordinator.async_refresh.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleSnoozeTask:
    """Tests for the snooze_task service handler."""

    async def test_no_entries_logs_warning_and_returns(self) -> None:
        hass = _make_hass(entries=[])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with patch("daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_TASK_ID: 1, ATTR_DAYS: 2}))
        mock_logger.warning.assert_called_once()

    async def test_multiple_entries_logs_warning_and_returns(self) -> None:
        entries = [_make_entry(entry_id="e1"), _make_entry(entry_id="e2")]
        hass = _make_hass(entries=entries)
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with patch("daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_TASK_ID: 1, ATTR_DAYS: 2}))
        mock_logger.warning.assert_called_once()

    async def test_success_calls_client_with_correct_args(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        await handler(_make_service_call(**{ATTR_TASK_ID: 3, ATTR_DAYS: 5}))
        client.async_snooze_task.assert_awaited_once_with(task_id=3, days=5)
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_authentication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_snooze_task.side_effect = DaynestApiClientAuthenticationError()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with pytest.raises(HomeAssistantError, match="Authentication error snoozing task"):
            await handler(_make_service_call(**{ATTR_TASK_ID: 3, ATTR_DAYS: 2}))

    async def test_communication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_snooze_task.side_effect = DaynestApiClientCommunicationError("err")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with pytest.raises(HomeAssistantError, match="Communication error snoozing task"):
            await handler(_make_service_call(**{ATTR_TASK_ID: 3, ATTR_DAYS: 2}))

    async def test_generic_api_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_snooze_task.side_effect = DaynestApiClientError("oops")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with pytest.raises(HomeAssistantError, match="Error snoozing task"):
            await handler(_make_service_call(**{ATTR_TASK_ID: 3, ATTR_DAYS: 2}))


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleMarkMedicationTaken:
    """Tests for the mark_medication_taken service handler."""

    async def test_no_entries_logs_warning_and_returns(self) -> None:
        hass = _make_hass(entries=[])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with patch("daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 10}))
        mock_logger.warning.assert_called_once()

    async def test_multiple_entries_logs_warning_and_returns(self) -> None:
        entries = [_make_entry(entry_id="e1"), _make_entry(entry_id="e2")]
        hass = _make_hass(entries=entries)
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with patch("daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 10}))
        mock_logger.warning.assert_called_once()

    async def test_success_calls_client_and_refreshes_coordinator(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 15}))
        client.async_mark_medication_taken.assert_awaited_once_with(medication_dose_id=15)
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_authentication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_mark_medication_taken.side_effect = DaynestApiClientAuthenticationError()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with pytest.raises(HomeAssistantError, match="Authentication error marking dose"):
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 15}))

    async def test_communication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_mark_medication_taken.side_effect = DaynestApiClientCommunicationError("network")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with pytest.raises(HomeAssistantError, match="Communication error marking dose"):
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 15}))

    async def test_generic_api_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_mark_medication_taken.side_effect = DaynestApiClientError("fail")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with pytest.raises(HomeAssistantError, match="Error marking dose"):
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 15}))

    async def test_error_does_not_trigger_coordinator_refresh(self) -> None:
        client = AsyncMock()
        client.async_mark_medication_taken.side_effect = DaynestApiClientError("fail")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with pytest.raises(HomeAssistantError):
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 15}))
        entry.runtime_data.coordinator.async_refresh.assert_not_awaited()
