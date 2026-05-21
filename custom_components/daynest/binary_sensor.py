"""Binary sensor platform for Daynest derived status flags."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.components.binary_sensor import BinarySensorEntity, BinarySensorEntityDescription
from homeassistant.util import dt as dt_util

from .entity import DaynestEntity

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    from .data import DaynestConfigEntry


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _is_medication_due_soon(data: dict[str, Any]) -> bool:
    reminder_minutes = max(0, _safe_int(data.get("medication_reminder_minutes"), 0))
    if reminder_minutes <= 0:
        return False

    now = dt_util.utcnow()
    window_end = now + timedelta(minutes=reminder_minutes)
    for dose in data.get("medications", []):
        if not isinstance(dose, dict):
            continue
        if str(dose.get("status") or "").lower() != "scheduled":
            continue
        scheduled_at = dose.get("scheduled_at")
        if not isinstance(scheduled_at, str):
            continue
        try:
            when = datetime.fromisoformat(scheduled_at)
        except ValueError:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=UTC)
        if now <= when <= window_end:
            return True
    return False


@dataclass(frozen=True, kw_only=True)
class DaynestBinarySensorEntityDescription(BinarySensorEntityDescription):
    """Describe a Daynest binary sensor."""

    is_on_func: Callable[[dict[str, Any]], bool]


ENTITY_DESCRIPTIONS: tuple[DaynestBinarySensorEntityDescription, ...] = (
    DaynestBinarySensorEntityDescription(
        key="daynest_has_overdue",
        translation_key="daynest_has_overdue",
        is_on_func=lambda data: _safe_int(data.get("overdue_count"), 0) > 0,
    ),
    DaynestBinarySensorEntityDescription(
        key="daynest_medication_missed",
        translation_key="daynest_medication_missed",
        is_on_func=lambda data: any(
            isinstance(item, dict) and str(item.get("status") or "").lower() == "missed"
            for item in data.get("medications", [])
        ),
    ),
    DaynestBinarySensorEntityDescription(
        key="daynest_all_done_today",
        translation_key="daynest_all_done_today",
        is_on_func=lambda data: _safe_float(data.get("completion_ratio"), 0.0) >= 1.0,
    ),
    DaynestBinarySensorEntityDescription(
        key="daynest_medication_due_soon",
        translation_key="daynest_medication_due_soon",
        is_on_func=_is_medication_due_soon,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Daynest binary sensors for a config entry."""
    async_add_entities(
        DaynestBinarySensor(
            coordinator=entry.runtime_data.coordinator,
            entity_description=entity_description,
        )
        for entity_description in ENTITY_DESCRIPTIONS
    )


class DaynestBinarySensor(BinarySensorEntity, DaynestEntity):
    """Expose Daynest binary state from coordinator data."""

    entity_description: DaynestBinarySensorEntityDescription

    @property
    def is_on(self) -> bool:
        """Return whether the binary sensor is active."""
        if not isinstance(self.coordinator.data, dict):
            return False
        return self.entity_description.is_on_func(self.coordinator.data)
