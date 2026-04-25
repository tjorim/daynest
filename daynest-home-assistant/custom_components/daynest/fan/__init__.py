"""Fan platform for daynest."""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.daynest.const import PARALLEL_UPDATES as PARALLEL_UPDATES
from homeassistant.components.fan import FanEntityDescription

from .air_purifier_fan import ENTITY_DESCRIPTIONS as FAN_DESCRIPTIONS, DaynestFan

if TYPE_CHECKING:
    from custom_components.daynest.data import DaynestConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

# Combine all entity descriptions from different modules
ENTITY_DESCRIPTIONS: tuple[FanEntityDescription, ...] = (*FAN_DESCRIPTIONS,)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the fan platform."""
    async_add_entities(
        DaynestFan(
            coordinator=entry.runtime_data.coordinator,
            entity_description=entity_description,
        )
        for entity_description in ENTITY_DESCRIPTIONS
    )
