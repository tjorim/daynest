"""Dashboard sensors for daynest."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from homeassistant.components.sensor import SensorEntity, SensorEntityDescription, SensorStateClass
from homeassistant.const import PERCENTAGE
from homeassistant.util import dt as dt_util

from ..entity import DaynestEntity

if TYPE_CHECKING:
    from ..coordinator import DaynestDataUpdateCoordinator

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

    @property
    def native_value(self) -> int | float | str | datetime | None:
        """Return the sensor's state."""
        if not self.coordinator.last_update_success:
            return None

        key = self.entity_description.key
        if key in {"overdue_count", "due_today_count"}:
            return self.coordinator.data[key]

        if key == "completion_ratio":
            ratio = self.coordinator.data["completion_ratio"]
            return round(ratio * 100, 1)

        if key == "next_medication":
            next_medication = self.coordinator.data.get("next_medication")
            if isinstance(next_medication, str):
                return next_medication

            medication = self._next_medication
            if medication is None:
                return None
            for field in ("name", "medication_name", "medicationName", "title", "id"):
                if (value := medication.get(field)) is not None:
                    return str(value)
            return None

        return None

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Return extra attributes for richer dashboard context."""
        if self.entity_description.key != "next_medication" or not self.coordinator.last_update_success:
            return None

        medication = self._next_medication
        if medication is None:
            return None

        due_at = medication.get("due_at")
        if due_at is None:
            due_at = medication.get("dueAt")
        if due_at is None:
            due_at = medication.get("scheduled_at")
        if due_at is None:
            due_at = medication.get("scheduledAt")
        if due_at is None:
            due_at = medication.get("timestamp")
        if isinstance(due_at, datetime):
            parsed_due = due_at
        elif isinstance(due_at, str):
            parsed_due = dt_util.parse_datetime(due_at)
        else:
            parsed_due = None

        due_at_str = parsed_due.isoformat() if parsed_due else str(due_at) if due_at is not None else None

        return {
            "medication_id": medication.get("id"),
            "dosage": medication.get("dosage"),
            "instructions": medication.get("instructions"),
            "due_at": due_at_str,
        }

    @property
    def _next_medication(self) -> dict[str, Any] | None:
        """Return the normalized next medication payload."""
        next_medication = self.coordinator.data.get("next_medication")
        if isinstance(next_medication, dict):
            return next_medication
        return None
