"""Unit tests for custom_components.daynest.services."""

from __future__ import annotations

from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.daynest.services import (
    ATTR_CHORE_INSTANCE_ID,
    ATTR_DAYS,
    ATTR_MEDICATION_DOSE_ID,
    ATTR_NOTES,
    ATTR_PLANNED_FOR,
    ATTR_PLANNED_ITEM_ID,
    ATTR_RRULE,
    ATTR_SCOPE,
    ATTR_TITLE,
    SERVICE_COMPLETE_TASK,
    SERVICE_CREATE_PLANNED_ITEM,
    SERVICE_MARK_MEDICATION_TAKEN,
    SERVICE_MARK_PLANNED_DONE,
    SERVICE_REFRESH,
    SERVICE_SKIP_MEDICATION,
    SERVICE_SKIP_TASK,
    SERVICE_SNOOZE_TASK,
    SERVICE_UPDATE_PLANNED_ITEM,
    async_setup_services,
    async_unload_services,
)
from daynest import DaynestAuthError, DaynestCommunicationError, DaynestError
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
        assert SERVICE_MARK_PLANNED_DONE in hass._registered_services
        assert SERVICE_SKIP_TASK in hass._registered_services
        assert SERVICE_SKIP_MEDICATION in hass._registered_services
        assert SERVICE_CREATE_PLANNED_ITEM in hass._registered_services
        assert SERVICE_UPDATE_PLANNED_ITEM in hass._registered_services

    async def test_unload_removes_all_services(self) -> None:
        hass = _make_hass()
        await async_setup_services(hass)
        async_unload_services(hass)
        assert SERVICE_REFRESH not in hass._registered_services
        assert SERVICE_COMPLETE_TASK not in hass._registered_services
        assert SERVICE_SNOOZE_TASK not in hass._registered_services
        assert SERVICE_MARK_MEDICATION_TAKEN not in hass._registered_services
        assert SERVICE_MARK_PLANNED_DONE not in hass._registered_services
        assert SERVICE_SKIP_TASK not in hass._registered_services
        assert SERVICE_SKIP_MEDICATION not in hass._registered_services
        assert SERVICE_CREATE_PLANNED_ITEM not in hass._registered_services
        assert SERVICE_UPDATE_PLANNED_ITEM not in hass._registered_services


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleRefresh:
    """Tests for the refresh service handler."""

    async def test_no_entries_logs_warning_and_returns(self) -> None:
        hass = _make_hass(entries=[])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_REFRESH)
        service_call = _make_service_call()
        with patch("custom_components.daynest.services.LOGGER") as mock_logger:
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
        with patch("custom_components.daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 42}))
        mock_logger.warning.assert_called_once()

    async def test_multiple_entries_logs_warning_and_returns(self) -> None:
        entries = [_make_entry(entry_id="e1"), _make_entry(entry_id="e2")]
        hass = _make_hass(entries=entries)
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with patch("custom_components.daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 42}))
        mock_logger.warning.assert_called_once()
        for entry in entries:
            entry.runtime_data.client.async_complete_task.assert_not_awaited()

    async def test_success_calls_client_and_refreshes_coordinator(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 7}))
        client.async_complete_task.assert_awaited_once_with(chore_instance_id=7)
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_authentication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_complete_task.side_effect = DaynestAuthError()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 7}))
        assert exc_info.value.translation_key == "service_auth_error"

    async def test_communication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_complete_task.side_effect = DaynestCommunicationError("network down")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 7}))
        assert exc_info.value.translation_key == "service_communication_error"

    async def test_generic_api_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_complete_task.side_effect = DaynestError("generic")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 7}))
        assert exc_info.value.translation_key == "service_error"

    async def test_error_does_not_trigger_coordinator_refresh(self) -> None:
        client = AsyncMock()
        client.async_complete_task.side_effect = DaynestError("fail")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_COMPLETE_TASK)
        with pytest.raises(HomeAssistantError):
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 7}))
        entry.runtime_data.coordinator.async_refresh.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleSnoozeTask:
    """Tests for the snooze_task service handler."""

    async def test_no_entries_logs_warning_and_returns(self) -> None:
        hass = _make_hass(entries=[])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with patch("custom_components.daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 1, ATTR_DAYS: 2}))
        mock_logger.warning.assert_called_once()

    async def test_multiple_entries_logs_warning_and_returns(self) -> None:
        entries = [_make_entry(entry_id="e1"), _make_entry(entry_id="e2")]
        hass = _make_hass(entries=entries)
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with patch("custom_components.daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 1, ATTR_DAYS: 2}))
        mock_logger.warning.assert_called_once()

    async def test_success_calls_client_with_correct_args(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 3, ATTR_DAYS: 5}))
        client.async_snooze_task.assert_awaited_once_with(chore_instance_id=3, days=5)
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_authentication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_snooze_task.side_effect = DaynestAuthError()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 3, ATTR_DAYS: 2}))
        assert exc_info.value.translation_key == "service_auth_error"

    async def test_communication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_snooze_task.side_effect = DaynestCommunicationError("err")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 3, ATTR_DAYS: 2}))
        assert exc_info.value.translation_key == "service_communication_error"

    async def test_generic_api_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_snooze_task.side_effect = DaynestError("oops")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SNOOZE_TASK)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 3, ATTR_DAYS: 2}))
        assert exc_info.value.translation_key == "service_error"


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleMarkMedicationTaken:
    """Tests for the mark_medication_taken service handler."""

    async def test_no_entries_logs_warning_and_returns(self) -> None:
        hass = _make_hass(entries=[])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with patch("custom_components.daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 10}))
        mock_logger.warning.assert_called_once()

    async def test_multiple_entries_logs_warning_and_returns(self) -> None:
        entries = [_make_entry(entry_id="e1"), _make_entry(entry_id="e2")]
        hass = _make_hass(entries=entries)
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with patch("custom_components.daynest.services.LOGGER") as mock_logger:
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
        client.async_mark_medication_taken.side_effect = DaynestAuthError()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 15}))
        assert exc_info.value.translation_key == "service_auth_error"

    async def test_communication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_mark_medication_taken.side_effect = DaynestCommunicationError("network")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 15}))
        assert exc_info.value.translation_key == "service_communication_error"

    async def test_generic_api_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_mark_medication_taken.side_effect = DaynestError("fail")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 15}))
        assert exc_info.value.translation_key == "service_error"

    async def test_error_does_not_trigger_coordinator_refresh(self) -> None:
        client = AsyncMock()
        client.async_mark_medication_taken.side_effect = DaynestError("fail")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_MEDICATION_TAKEN)
        with pytest.raises(HomeAssistantError):
            await handler(_make_service_call(**{ATTR_MEDICATION_DOSE_ID: 15}))
        entry.runtime_data.coordinator.async_refresh.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleSkipTask:
    """Tests for the skip_task service handler."""

    async def test_success_calls_client_with_chore_instance_id(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SKIP_TASK)
        await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 9}))
        client.async_skip_task.assert_awaited_once_with(chore_instance_id=9)
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_authentication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_skip_task.side_effect = DaynestAuthError()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_SKIP_TASK)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_CHORE_INSTANCE_ID: 9}))
        assert exc_info.value.translation_key == "service_auth_error"


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleMarkPlannedDone:
    """Tests for the mark_planned_done service handler."""

    async def test_no_entries_logs_warning_and_returns(self) -> None:
        hass = _make_hass(entries=[])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_PLANNED_DONE)
        with patch("custom_components.daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_PLANNED_ITEM_ID: 5}))
        mock_logger.warning.assert_called_once()

    async def test_multiple_entries_logs_warning_and_returns(self) -> None:
        entries = [_make_entry(entry_id="e1"), _make_entry(entry_id="e2")]
        hass = _make_hass(entries=entries)
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_PLANNED_DONE)
        with patch("custom_components.daynest.services.LOGGER") as mock_logger:
            await handler(_make_service_call(**{ATTR_PLANNED_ITEM_ID: 5}))
        mock_logger.warning.assert_called_once()
        for entry in entries:
            entry.runtime_data.client.async_mark_planned_done.assert_not_awaited()

    async def test_success_calls_client_and_refreshes_coordinator(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_PLANNED_DONE)
        await handler(_make_service_call(**{ATTR_PLANNED_ITEM_ID: 42}))
        client.async_mark_planned_done.assert_awaited_once_with(planned_item_id=42)
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_authentication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_mark_planned_done.side_effect = DaynestAuthError()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_PLANNED_DONE)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_PLANNED_ITEM_ID: 42}))
        assert exc_info.value.translation_key == "service_auth_error"

    async def test_communication_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_mark_planned_done.side_effect = DaynestCommunicationError("network")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_PLANNED_DONE)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_PLANNED_ITEM_ID: 42}))
        assert exc_info.value.translation_key == "service_communication_error"

    async def test_generic_api_error_raises_homeassistant_error(self) -> None:
        client = AsyncMock()
        client.async_mark_planned_done.side_effect = DaynestError("fail")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_PLANNED_DONE)
        with pytest.raises(HomeAssistantError) as exc_info:
            await handler(_make_service_call(**{ATTR_PLANNED_ITEM_ID: 42}))
        assert exc_info.value.translation_key == "service_error"

    async def test_error_does_not_trigger_coordinator_refresh(self) -> None:
        client = AsyncMock()
        client.async_mark_planned_done.side_effect = DaynestError("fail")
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_MARK_PLANNED_DONE)
        with pytest.raises(HomeAssistantError):
            await handler(_make_service_call(**{ATTR_PLANNED_ITEM_ID: 42}))
        entry.runtime_data.coordinator.async_refresh.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleCreatePlannedItem:
    """Tests for the create_planned_item service handler."""

    async def test_success_calls_client_and_refreshes(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_CREATE_PLANNED_ITEM)

        await handler(
            _make_service_call(
                **{
                    ATTR_TITLE: "Buy milk",
                    ATTR_PLANNED_FOR: "2026-05-21",
                    ATTR_NOTES: "2L",
                }
            )
        )

        client.async_create_planned_item.assert_awaited_once_with(
            title="Buy milk",
            planned_for="2026-05-21",
            notes="2L",
        )
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_date_planned_for_is_serialized_and_refreshes(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_CREATE_PLANNED_ITEM)

        await handler(
            _make_service_call(
                **{
                    ATTR_TITLE: "Buy milk",
                    ATTR_PLANNED_FOR: date(2026, 5, 22),
                }
            )
        )

        client.async_create_planned_item.assert_awaited_once_with(
            title="Buy milk",
            planned_for="2026-05-22",
            notes=None,
        )
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_missing_planned_for_uses_coordinator_date_and_refreshes(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        entry.runtime_data.coordinator.data = {"for_date": "2026-05-23"}
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_CREATE_PLANNED_ITEM)

        await handler(_make_service_call(**{ATTR_TITLE: "Buy milk"}))

        client.async_create_planned_item.assert_awaited_once_with(
            title="Buy milk",
            planned_for="2026-05-23",
            notes=None,
        )
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

        client.reset_mock()
        entry.runtime_data.coordinator.async_refresh.reset_mock()
        entry.runtime_data.coordinator.data = None

        with patch("custom_components.daynest.services.datetime") as mock_datetime:
            mock_datetime.now.return_value = datetime(2026, 5, 24, tzinfo=UTC)
            await handler(_make_service_call(**{ATTR_TITLE: "Buy bread"}))

        client.async_create_planned_item.assert_awaited_once_with(
            title="Buy bread",
            planned_for="2026-05-24",
            notes=None,
        )
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()


@pytest.mark.unit
@pytest.mark.asyncio
class TestHandleUpdatePlannedItem:
    """Tests for the update_planned_item service handler."""

    async def test_success_calls_client_and_refreshes(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_UPDATE_PLANNED_ITEM)

        await handler(
            _make_service_call(
                **{
                    ATTR_PLANNED_ITEM_ID: 42,
                    ATTR_SCOPE: "future",
                    ATTR_TITLE: "Buy milk",
                    ATTR_PLANNED_FOR: date(2026, 5, 21),
                    ATTR_NOTES: "2L",
                    ATTR_RRULE: "FREQ=WEEKLY",
                }
            )
        )

        client.async_update_planned_item.assert_awaited_once_with(
            item_id=42,
            scope="future",
            title="Buy milk",
            planned_for=date(2026, 5, 21),
            notes="2L",
            rrule="FREQ=WEEKLY",
        )
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()

    async def test_missing_scope_defaults_to_this(self) -> None:
        client = AsyncMock()
        entry = _make_entry(client=client)
        hass = _make_hass(entries=[entry])
        await async_setup_services(hass)
        handler = await _get_handler(hass, SERVICE_UPDATE_PLANNED_ITEM)

        await handler(_make_service_call(**{ATTR_PLANNED_ITEM_ID: 42}))

        client.async_update_planned_item.assert_awaited_once_with(
            item_id=42,
            scope="this",
        )
        entry.runtime_data.coordinator.async_refresh.assert_awaited_once()
