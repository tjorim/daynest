"""Unit tests for custom_components.daynest.number."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.daynest.coordinator import POLL_INTERVAL_OPTION
from custom_components.daynest.number import ENTITY_DESCRIPTIONS, DaynestNumberEntity


def _make_entry() -> MagicMock:
    entry = MagicMock()
    entry.options = {}
    entry.runtime_data.client.async_update_user_settings = AsyncMock()
    return entry


def _make_coordinator(data: dict | None = None) -> MagicMock:
    coordinator = MagicMock()
    coordinator.data = data or {"default_snooze_days": 3}
    coordinator.config_entry.entry_id = "test_entry_id"
    coordinator.config_entry.domain = "daynest"
    coordinator.config_entry.title = "Daynest Test"
    coordinator.async_request_refresh = AsyncMock()
    coordinator.async_set_poll_interval = AsyncMock()
    return coordinator


def _make_entity(key: str, data: dict | None = None, options: dict | None = None) -> DaynestNumberEntity:
    description = next(desc for desc in ENTITY_DESCRIPTIONS if desc.key == key)
    entry = _make_entry()
    if options is not None:
        entry.options = options
    coordinator = _make_coordinator(data)
    entity = DaynestNumberEntity(config_entry=entry, coordinator=coordinator, entity_description=description)
    entity.hass = MagicMock()
    return entity


@pytest.mark.unit
class TestDaynestNumberEntity:
    async def test_set_snooze_days_patches_settings_and_refreshes(self) -> None:
        entity = _make_entity("snooze_days")
        await entity.async_set_native_value(5)
        entity._config_entry.runtime_data.client.async_update_user_settings.assert_awaited_once_with(
            {"default_snooze_days": 5}
        )
        entity.coordinator.async_request_refresh.assert_awaited_once()

    async def test_set_poll_interval_updates_options_and_reschedules(self) -> None:
        entity = _make_entity("coordinator_poll_interval", options={})
        await entity.async_set_native_value(9)
        entity.hass.config_entries.async_update_entry.assert_called_once_with(
            entity._config_entry,
            options={POLL_INTERVAL_OPTION: 9},
        )
        entity.coordinator.async_set_poll_interval.assert_awaited_once_with(9)
