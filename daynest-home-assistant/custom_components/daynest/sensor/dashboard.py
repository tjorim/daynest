"""Dashboard sensors for daynest."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from custom_components.daynest.entity import DaynestEntity
from homeassistant.components.sensor import SensorEntity, SensorEntityDescription, SensorStateClass
from homeassistant.const import PERCENTAGE
from homeassistant.util import dt as dt_util

if TYPE_CHECKING:
    from custom_components.daynest.coordinator import DaynestDataUpdateCoordinator

ENTITY_DESCRIPTIONS = (
    SensorEntityDescription(
        key="overdue_count",
        translation_key="overdue_count",
        icon="mdi:calendar-alert",
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        has_entity_name=True,
    ),
    SensorEntityDescription(
        key="due_today_count",
        translation_key="due_today_count",
        icon="mdi:calendar-today",
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        has_entity_name=True,
    ),
    SensorEntityDescription(
        key="completion_ratio",
        translation_key="completion_ratio",
        icon="mdi:chart-donut",
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        has_entity_name=True,
    ),
    SensorEntityDescription(
        key="next_medication",
        translation_key="next_medication",
        icon="mdi:pill",
        has_entity_name=True,
    ),
)


class DaynestDashboardSensor(SensorEntity, DaynestEntity):
    """Dashboard sensor class for care metrics."""

    def __init__(
        self,
        coordinator: DaynestDataUpdateCoordinator,
        entity_description: SensorEntityDescription,
    ) -> None:
        """Initialize the dashboard sensor."""
        super().__init__(coordinator, entity_description)

    @property
    def native_value(self) -> int | float | str | datetime | None:
        """Return the sensor's state."""
        if not self.coordinator.last_update_success:
            return None

        key = self.entity_description.key
        if key in {"overdue_count", "due_today_count"}:
            return int(self.coordinator.data.get(key, 0))

        if key == "completion_ratio":
            ratio = float(self.coordinator.data.get("completion_ratio", 0.0))
            return round(ratio * 100, 1)

        if key == "next_medication":
            medication = self._next_medication
            if medication is None:
                return None
            return str(
                medication.get("name")
                or medication.get("medicationName")
                or medication.get("title")
                or medication.get("id")
                or ""
            ) or None

        return None

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Return extra attributes for richer dashboard context."""
        if self.entity_description.key != "next_medication" or not self.coordinator.last_update_success:
            return None

        medication = self._next_medication
        if medication is None:
            return None

        due_at = medication.get("dueAt") or medication.get("scheduledAt") or medication.get("timestamp")
        parsed_due = dt_util.parse_datetime(str(due_at)) if due_at is not None else None

        return {
            "medication_id": medication.get("id"),
            "dosage": medication.get("dosage"),
            "instructions": medication.get("instructions"),
            "due_at": parsed_due.isoformat() if parsed_due is not None else due_at,
        }

    @property
    def _next_medication(self) -> dict[str, Any] | None:
        """Return the normalized next medication payload."""
        next_medication = self.coordinator.data.get("next_medication")
        if isinstance(next_medication, dict):
            return next_medication
        return None
