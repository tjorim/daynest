"""Number platform for configurable Daynest integration settings."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from homeassistant.components.number import NumberEntity, NumberEntityDescription, NumberMode

from .coordinator import (
    DEFAULT_POLL_INTERVAL_MINUTES,
    MAX_POLL_INTERVAL_MINUTES,
    MIN_POLL_INTERVAL_MINUTES,
    POLL_INTERVAL_OPTION,
)
from .entity import DaynestEntity

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    from .data import DaynestConfigEntry


@dataclass(frozen=True, kw_only=True)
class DaynestNumberEntityDescription(NumberEntityDescription):
    """Describe a Daynest number entity."""

    value_key: str


ENTITY_DESCRIPTIONS: tuple[DaynestNumberEntityDescription, ...] = (
    DaynestNumberEntityDescription(
        key="snooze_days",
        translation_key="snooze_days",
        native_min_value=1,
        native_max_value=14,
        native_step=1,
        mode=NumberMode.BOX,
        value_key="default_snooze_days",
    ),
    DaynestNumberEntityDescription(
        key="coordinator_poll_interval",
        translation_key="coordinator_poll_interval",
        native_min_value=MIN_POLL_INTERVAL_MINUTES,
        native_max_value=MAX_POLL_INTERVAL_MINUTES,
        native_step=1,
        mode=NumberMode.BOX,
        value_key=POLL_INTERVAL_OPTION,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Daynest number entities for a config entry."""
    async_add_entities(
        DaynestNumberEntity(
            config_entry=entry,
            coordinator=entry.runtime_data.coordinator,
            entity_description=entity_description,
        )
        for entity_description in ENTITY_DESCRIPTIONS
    )


class DaynestNumberEntity(NumberEntity, DaynestEntity):
    """Expose writable Daynest numeric settings."""

    entity_description: DaynestNumberEntityDescription

    def __init__(
        self,
        *,
        config_entry: DaynestConfigEntry,
        coordinator,
        entity_description: DaynestNumberEntityDescription,
    ) -> None:
        """Initialize number entity."""
        super().__init__(coordinator, entity_description)
        self._config_entry = config_entry

    @property
    def native_value(self) -> float:
        """Return current value."""
        if self.entity_description.key == "coordinator_poll_interval":
            raw_value = self._config_entry.options.get(POLL_INTERVAL_OPTION, DEFAULT_POLL_INTERVAL_MINUTES)
        else:
            raw_value = (
                self.coordinator.data.get(self.entity_description.value_key)
                if isinstance(self.coordinator.data, dict)
                else 1
            )
        try:
            parsed = int(raw_value)
        except (TypeError, ValueError):
            parsed = int(self.entity_description.native_min_value)
        return float(parsed)

    async def async_set_native_value(self, value: float) -> None:
        """Set a new number value."""
        int_value = int(round(value))
        if self.entity_description.key == "coordinator_poll_interval":
            options = dict(self._config_entry.options)
            options[POLL_INTERVAL_OPTION] = int_value
            self.hass.config_entries.async_update_entry(self._config_entry, options=options)
            await self.coordinator.async_set_poll_interval(int_value)
            return

        await self._config_entry.runtime_data.client.async_update_user_settings(
            {self.entity_description.value_key: int_value}
        )
        await self.coordinator.async_request_refresh()
