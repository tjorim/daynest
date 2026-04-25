"""Sensor platform for Daynest dashboard metrics."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from homeassistant.components.sensor import SensorEntity, SensorEntityDescription, SensorStateClass
from homeassistant.const import PERCENTAGE

from ..const import PARALLEL_UPDATES
from ..entity import DaynestEntity

if TYPE_CHECKING:
    from ..coordinator import DaynestDataUpdateCoordinator
    from ..data import DaynestConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback


@dataclass(frozen=True, kw_only=True)
class DaynestSensorEntityDescription(SensorEntityDescription):
    """Describe a Daynest dashboard sensor."""

    value_key: str
    scale: float = 1.0


ENTITY_DESCRIPTIONS: tuple[DaynestSensorEntityDescription, ...] = (
    DaynestSensorEntityDescription(
        key="due_today_count",
        translation_key="due_today_count",
        icon="mdi:format-list-checks",
        state_class=SensorStateClass.MEASUREMENT,
        value_key="due_today_count",
    ),
    DaynestSensorEntityDescription(
        key="overdue_count",
        translation_key="overdue_count",
        icon="mdi:alert-circle-outline",
        state_class=SensorStateClass.MEASUREMENT,
        value_key="overdue_count",
    ),
    DaynestSensorEntityDescription(
        key="planned_count",
        translation_key="planned_count",
        icon="mdi:calendar-text-outline",
        state_class=SensorStateClass.MEASUREMENT,
        value_key="planned_count",
    ),
    DaynestSensorEntityDescription(
        key="medication_due_count",
        translation_key="medication_due_count",
        icon="mdi:pill",
        state_class=SensorStateClass.MEASUREMENT,
        value_key="medication_due_count",
    ),
    DaynestSensorEntityDescription(
        key="completion_ratio",
        translation_key="completion_ratio",
        icon="mdi:percent-circle-outline",
        native_unit_of_measurement=PERCENTAGE,
        suggested_display_precision=0,
        state_class=SensorStateClass.MEASUREMENT,
        value_key="completion_ratio",
        scale=100,
    ),
    DaynestSensorEntityDescription(
        key="next_medication",
        translation_key="next_medication",
        icon="mdi:clock-time-eight-outline",
        value_key="next_medication",
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Daynest sensors for a config entry."""
    async_add_entities(
        DaynestMetricSensor(
            coordinator=entry.runtime_data.coordinator,
            entity_description=entity_description,
        )
        for entity_description in ENTITY_DESCRIPTIONS
    )


class DaynestMetricSensor(SensorEntity, DaynestEntity):
    """Expose a single field from the Daynest dashboard payload."""

    entity_description: DaynestSensorEntityDescription

    def __init__(
        self,
        coordinator: DaynestDataUpdateCoordinator,
        entity_description: DaynestSensorEntityDescription,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, entity_description)

    @property
    def native_value(self) -> int | float | str | None:
        """Return the current sensor value."""
        if self.coordinator.data is None:
            return None
        value = self.coordinator.data.get(self.entity_description.value_key)
        if value is None:
            return None

        if self.entity_description.scale != 1.0:
            try:
                return round(float(value) * self.entity_description.scale, 0)
            except (TypeError, ValueError):
                return None

        return value

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return shared Daynest context for the current reading."""
        if self.coordinator.data is None:
            return {}
        attributes: dict[str, Any] = {
            "for_date": self.coordinator.data.get("for_date"),
            "integration_contract": self.coordinator.data.get("integration_contract"),
        }

        if self.entity_description.key == "next_medication":
            attributes["medication_due_count"] = self.coordinator.data.get("medication_due_count")

        return {key: value for key, value in attributes.items() if value is not None}
