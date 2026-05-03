"""Unit tests for custom_components.daynest.sensor."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from daynest.sensor import ENTITY_DESCRIPTIONS, DaynestMetricSensor, DaynestSensorEntityDescription
from homeassistant.components.sensor import SensorStateClass

COORDINATOR_DATA = {
    "for_date": "2026-01-15",
    "due_today_count": 3,
    "overdue_count": 1,
    "planned_count": 2,
    "medication_due_count": 1,
    "completion_ratio": 0.5,
    "next_medication": "08:00",
    "integration_contract": "ha.v1",
}


def _make_coordinator(data: dict | None = COORDINATOR_DATA) -> MagicMock:
    coordinator = MagicMock()
    coordinator.data = data
    coordinator.config_entry.entry_id = "test_entry_id"
    coordinator.config_entry.domain = "daynest"
    coordinator.config_entry.title = "Daynest Test"
    return coordinator


def _make_sensor(
    key: str,
    value_key: str,
    scale: float = 1.0,
    coordinator_data: dict | None = COORDINATOR_DATA,
) -> DaynestMetricSensor:
    description = DaynestSensorEntityDescription(
        key=key,
        translation_key=key,
        value_key=value_key,
        scale=scale,
        state_class=SensorStateClass.MEASUREMENT,
    )
    coordinator = _make_coordinator(data=coordinator_data)
    return DaynestMetricSensor(coordinator=coordinator, entity_description=description)


def _get_description(key: str) -> DaynestSensorEntityDescription:
    for desc in ENTITY_DESCRIPTIONS:
        if desc.key == key:
            return desc
    msg = f"No entity description with key {key!r}"
    raise KeyError(msg)


@pytest.mark.unit
class TestEntityDescriptions:
    """Tests for the ENTITY_DESCRIPTIONS constant."""

    def test_all_expected_sensors_defined(self) -> None:
        keys = {desc.key for desc in ENTITY_DESCRIPTIONS}
        expected = {
            "due_today_count",
            "overdue_count",
            "planned_count",
            "medication_due_count",
            "completion_ratio",
            "next_medication",
        }
        assert expected.issubset(keys)

    def test_completion_ratio_has_scale_100(self) -> None:
        desc = _get_description("completion_ratio")
        assert desc.scale == 100

    def test_non_ratio_sensors_have_scale_1(self) -> None:
        for desc in ENTITY_DESCRIPTIONS:
            if desc.key != "completion_ratio":
                assert desc.scale == 1.0, f"{desc.key} should have scale 1.0"

    def test_each_description_has_icon(self) -> None:
        for desc in ENTITY_DESCRIPTIONS:
            assert desc.icon, f"{desc.key} is missing an icon"

    def test_each_description_has_value_key(self) -> None:
        for desc in ENTITY_DESCRIPTIONS:
            assert desc.value_key, f"{desc.key} is missing value_key"


@pytest.mark.unit
class TestDaynestMetricSensorNativeValue:
    """Tests for DaynestMetricSensor.native_value."""

    def test_returns_integer_field_from_coordinator_data(self) -> None:
        sensor = _make_sensor(key="overdue_count", value_key="overdue_count")
        assert sensor.native_value == 1

    def test_returns_string_field_from_coordinator_data(self) -> None:
        sensor = _make_sensor(key="next_medication", value_key="next_medication")
        assert sensor.native_value == "08:00"

    def test_returns_float_field_from_coordinator_data(self) -> None:
        sensor = _make_sensor(key="completion_ratio", value_key="completion_ratio")
        assert sensor.native_value == 0.5

    def test_applies_scale_to_numeric_value(self) -> None:
        sensor = _make_sensor(key="completion_ratio", value_key="completion_ratio", scale=100)
        assert sensor.native_value == 50.0

    def test_returns_none_when_coordinator_data_is_none(self) -> None:
        # Sensor must be created with valid data (init accesses coordinator.data.get),
        # then data is cleared to simulate a coordinator that has not yet been populated.
        sensor = _make_sensor(key="due_today_count", value_key="due_today_count")
        sensor.coordinator.data = None
        assert sensor.native_value is None

    def test_returns_none_when_value_key_missing_from_data(self) -> None:
        data = {k: v for k, v in COORDINATOR_DATA.items() if k != "overdue_count"}
        sensor = _make_sensor(key="overdue_count", value_key="overdue_count", coordinator_data=data)
        assert sensor.native_value is None

    def test_returns_none_when_value_is_none_in_data(self) -> None:
        data = {**COORDINATOR_DATA, "next_medication": None}
        sensor = _make_sensor(key="next_medication", value_key="next_medication", coordinator_data=data)
        assert sensor.native_value is None

    def test_scale_with_non_numeric_value_returns_none(self) -> None:
        data = {**COORDINATOR_DATA, "completion_ratio": "not-a-float"}
        sensor = _make_sensor(key="completion_ratio", value_key="completion_ratio", scale=100, coordinator_data=data)
        assert sensor.native_value is None

    def test_due_today_count_value(self) -> None:
        sensor = _make_sensor(key="due_today_count", value_key="due_today_count")
        assert sensor.native_value == 3

    def test_planned_count_value(self) -> None:
        sensor = _make_sensor(key="planned_count", value_key="planned_count")
        assert sensor.native_value == 2

    def test_medication_due_count_value(self) -> None:
        sensor = _make_sensor(key="medication_due_count", value_key="medication_due_count")
        assert sensor.native_value == 1


@pytest.mark.unit
class TestDaynestMetricSensorExtraStateAttributes:
    """Tests for DaynestMetricSensor.extra_state_attributes."""

    def test_returns_empty_dict_when_coordinator_data_is_none(self) -> None:
        # Sensor must be created with valid data first (init accesses coordinator.data.get),
        # then data is cleared to simulate missing data.
        sensor = _make_sensor(key="overdue_count", value_key="overdue_count")
        sensor.coordinator.data = None
        assert sensor.extra_state_attributes == {}

    def test_includes_for_date_in_attributes(self) -> None:
        sensor = _make_sensor(key="overdue_count", value_key="overdue_count")
        assert sensor.extra_state_attributes["for_date"] == "2026-01-15"

    def test_includes_integration_contract_in_attributes(self) -> None:
        sensor = _make_sensor(key="overdue_count", value_key="overdue_count")
        assert sensor.extra_state_attributes["integration_contract"] == "ha.v1"

    def test_next_medication_sensor_includes_medication_due_count(self) -> None:
        sensor = _make_sensor(key="next_medication", value_key="next_medication")
        assert "medication_due_count" in sensor.extra_state_attributes
        assert sensor.extra_state_attributes["medication_due_count"] == 1

    def test_non_next_medication_sensor_excludes_medication_due_count(self) -> None:
        sensor = _make_sensor(key="overdue_count", value_key="overdue_count")
        assert "medication_due_count" not in sensor.extra_state_attributes

    def test_none_values_excluded_from_attributes(self) -> None:
        data = {**COORDINATOR_DATA, "for_date": None, "integration_contract": None}
        sensor = _make_sensor(key="overdue_count", value_key="overdue_count", coordinator_data=data)
        assert "for_date" not in sensor.extra_state_attributes
        assert "integration_contract" not in sensor.extra_state_attributes

    def test_missing_for_date_excluded_from_attributes(self) -> None:
        data = {k: v for k, v in COORDINATOR_DATA.items() if k != "for_date"}
        sensor = _make_sensor(key="overdue_count", value_key="overdue_count", coordinator_data=data)
        assert "for_date" not in sensor.extra_state_attributes


@pytest.mark.unit
class TestDaynestMetricSensorUniqueId:
    """Tests for DaynestMetricSensor unique_id generation."""

    def test_unique_id_contains_entry_id_and_key(self) -> None:
        sensor = _make_sensor(key="overdue_count", value_key="overdue_count")
        assert sensor.unique_id == "test_entry_id_overdue_count"

    def test_unique_ids_differ_between_sensors_of_same_entry(self) -> None:
        sensor_a = _make_sensor(key="overdue_count", value_key="overdue_count")
        sensor_b = _make_sensor(key="due_today_count", value_key="due_today_count")
        assert sensor_a.unique_id != sensor_b.unique_id
