"""Unit tests for custom_components.daynest.binary_sensor."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from custom_components.daynest.binary_sensor import ENTITY_DESCRIPTIONS, DaynestBinarySensor


def _make_coordinator(data: dict | None) -> MagicMock:
    coordinator = MagicMock()
    coordinator.data = data
    coordinator.config_entry.entry_id = "test_entry_id"
    coordinator.config_entry.domain = "daynest"
    coordinator.config_entry.title = "Daynest Test"
    return coordinator


def _make_sensor(key: str, data: dict | None) -> DaynestBinarySensor:
    description = next(desc for desc in ENTITY_DESCRIPTIONS if desc.key == key)
    return DaynestBinarySensor(coordinator=_make_coordinator(data), entity_description=description)


@pytest.mark.unit
class TestDaynestBinarySensor:
    def test_has_overdue_on_when_overdue_count_positive(self) -> None:
        sensor = _make_sensor("daynest_has_overdue", {"overdue_count": 1})
        assert sensor.is_on is True

    def test_medication_missed_on_when_any_missed_status(self) -> None:
        sensor = _make_sensor(
            "daynest_medication_missed",
            {"medications": [{"medication_dose_instance_id": 10, "status": "missed"}]},
        )
        assert sensor.is_on is True

    def test_all_done_today_on_when_completion_ratio_is_one(self) -> None:
        sensor = _make_sensor("daynest_all_done_today", {"completion_ratio": 1.0})
        assert sensor.is_on is True

    def test_medication_due_soon_uses_reminder_window(self) -> None:
        now = datetime(2026, 5, 21, 8, 0, tzinfo=UTC)
        due_soon = now + timedelta(minutes=10)
        data = {
            "medication_reminder_minutes": 30,
            "medications": [{"medication_dose_instance_id": 7, "status": "scheduled", "scheduled_at": due_soon.isoformat()}],
        }
        with patch("custom_components.daynest.binary_sensor.dt_util.utcnow", return_value=now):
            sensor = _make_sensor("daynest_medication_due_soon", data)
            assert sensor.is_on is True
