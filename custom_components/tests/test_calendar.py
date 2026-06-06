"""Unit tests for custom_components.daynest.calendar."""

from __future__ import annotations

from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.daynest.calendar import (
    DaynestChoresCalendar,
    DaynestMealPlanCalendarEntity,
    DaynestMedicationsCalendar,
    DaynestPlannedCalendar,
    _parse_event,
    async_setup_entry,
)
from daynest import DaynestError
from homeassistant.components.calendar import CalendarEvent
from homeassistant.helpers.entity import EntityDescription


def _make_coordinator(client: MagicMock | None = None) -> MagicMock:
    coordinator = MagicMock()
    coordinator.data = {"model": "Unknown", "meal_slots": []}
    coordinator.config_entry.entry_id = "test_entry_id"
    coordinator.config_entry.domain = "daynest"
    coordinator.config_entry.title = "Daynest Test"
    coordinator.config_entry.runtime_data.client = client or MagicMock()
    return coordinator


def _make_entity(
    entity_cls: type[DaynestChoresCalendar | DaynestMedicationsCalendar | DaynestPlannedCalendar],
    client: MagicMock | None = None,
):
    coordinator = _make_coordinator(client)
    key = {
        DaynestChoresCalendar: "daynest_chores_calendar",
        DaynestMedicationsCalendar: "daynest_medications_calendar",
        DaynestPlannedCalendar: "daynest_planned_calendar",
        DaynestMealPlanCalendarEntity: "daynest_meal_plan_calendar",
    }[entity_cls]
    description = EntityDescription(key=key, translation_key=key)
    return entity_cls(coordinator=coordinator, entity_description=description)


@pytest.mark.unit
class TestParseEvent:
    """Tests for the _parse_event helper."""

    def test_all_day_event_returns_date_objects(self) -> None:
        raw = {
            "uid": "chore-1",
            "summary": "Clean kitchen",
            "start": {"date": "2026-05-17"},
            "end": {"date": "2026-05-18"},
        }
        event = _parse_event(raw)
        assert event is not None
        assert isinstance(event.start, date) and not isinstance(event.start, datetime)
        assert event.start == date(2026, 5, 17)
        assert event.end == date(2026, 5, 18)

    def test_timed_event_returns_datetime_objects(self) -> None:
        raw = {
            "uid": "med-2",
            "summary": "Vitamin D",
            "start": {"dateTime": "2026-05-17T09:00:00"},
            "end": {"dateTime": "2026-05-17T09:15:00"},
        }
        event = _parse_event(raw)
        assert event is not None
        assert isinstance(event.start, datetime)
        assert event.start == datetime(2026, 5, 17, 9, 0, 0, tzinfo=UTC)

    def test_summary_and_uid_preserved(self) -> None:
        raw = {
            "uid": "test-uid",
            "summary": "My Event",
            "start": {"date": "2026-05-17"},
            "end": {"date": "2026-05-18"},
        }
        event = _parse_event(raw)
        assert event is not None
        assert event.summary == "My Event"
        assert event.uid == "test-uid"

    def test_description_preserved(self) -> None:
        raw = {
            "uid": "med-3",
            "summary": "Med",
            "start": {"dateTime": "2026-05-17T08:00:00"},
            "end": {"dateTime": "2026-05-17T08:15:00"},
            "description": "Take with food",
        }
        event = _parse_event(raw)
        assert event is not None
        assert event.description == "Take with food"

    def test_missing_summary_defaults_to_event(self) -> None:
        raw = {
            "start": {"date": "2026-05-17"},
            "end": {"date": "2026-05-18"},
        }
        event = _parse_event(raw)
        assert event is not None
        assert event.summary == "Event"

    def test_missing_start_returns_none(self) -> None:
        raw = {"uid": "x", "summary": "Missing start", "end": {"date": "2026-05-18"}}
        assert _parse_event(raw) is None

    def test_invalid_date_format_returns_none(self) -> None:
        raw = {
            "uid": "x",
            "summary": "Bad date",
            "start": {"date": "not-a-date"},
            "end": {"date": "2026-05-18"},
        }
        assert _parse_event(raw) is None

    def test_invalid_datetime_format_returns_none(self) -> None:
        raw = {
            "uid": "x",
            "summary": "Bad datetime",
            "start": {"dateTime": "not-a-datetime"},
            "end": {"dateTime": "2026-05-17T09:00:00"},
        }
        assert _parse_event(raw) is None

    def test_none_description_stored_as_none(self) -> None:
        raw = {
            "uid": "x",
            "summary": "No desc",
            "start": {"date": "2026-05-17"},
            "end": {"date": "2026-05-18"},
            "description": None,
        }
        event = _parse_event(raw)
        assert event is not None
        assert event.description is None


@pytest.mark.unit
class TestDaynestCalendarEntityGetEvents:
    """Tests for DaynestCalendarEntity.async_get_events."""

    async def test_returns_parsed_events_on_success(self) -> None:
        client = MagicMock()
        client.async_get_calendar = AsyncMock(
            return_value=[
                {
                    "uid": "chore-1",
                    "summary": "Clean kitchen",
                    "start": {"date": "2026-05-17"},
                    "end": {"date": "2026-05-18"},
                },
                {
                    "uid": "med-2",
                    "summary": "Vitamin D",
                    "start": {"dateTime": "2026-05-17T09:00:00"},
                    "end": {"dateTime": "2026-05-17T09:15:00"},
                },
            ]
        )
        entity = _make_entity(DaynestChoresCalendar, client)
        hass = MagicMock()
        start = datetime(2026, 5, 17, 0, 0)
        end = datetime(2026, 5, 17, 23, 59)

        events = await entity.async_get_events(hass, start, end)

        assert len(events) == 2
        assert events[0].summary == "Clean kitchen"
        assert events[1].summary == "Vitamin D"

    async def test_api_error_returns_empty_list(self) -> None:
        client = MagicMock()
        client.async_get_calendar = AsyncMock(side_effect=DaynestError("network fail"))
        entity = _make_entity(DaynestChoresCalendar, client)
        hass = MagicMock()

        events = await entity.async_get_events(hass, datetime(2026, 5, 1), datetime(2026, 5, 31))

        assert events == []

    async def test_unparseable_events_skipped(self) -> None:
        client = MagicMock()
        client.async_get_calendar = AsyncMock(
            return_value=[
                {"uid": "ok", "summary": "Good", "start": {"date": "2026-05-17"}, "end": {"date": "2026-05-18"}},
                {"uid": "bad", "summary": "Bad date", "start": {"date": "not-valid"}, "end": {"date": "2026-05-18"}},
            ]
        )
        entity = _make_entity(DaynestChoresCalendar, client)
        hass = MagicMock()

        events = await entity.async_get_events(hass, datetime(2026, 5, 1), datetime(2026, 5, 31))

        assert len(events) == 1
        assert events[0].summary == "Good"

    async def test_passes_date_range_to_client(self) -> None:
        client = MagicMock()
        client.async_get_calendar = AsyncMock(return_value=[])
        entity = _make_entity(DaynestChoresCalendar, client)
        hass = MagicMock()

        await entity.async_get_events(hass, datetime(2026, 5, 1, 0, 0), datetime(2026, 5, 31, 23, 59))

        client.async_get_calendar.assert_called_once_with(date(2026, 5, 1), date(2026, 5, 31), event_type="chores")

    async def test_passes_medications_type_filter(self) -> None:
        client = MagicMock()
        client.async_get_calendar = AsyncMock(return_value=[])
        entity = _make_entity(DaynestMedicationsCalendar, client)
        hass = MagicMock()
        await entity.async_get_events(hass, datetime(2026, 5, 1, 0, 0), datetime(2026, 5, 31, 23, 59))
        client.async_get_calendar.assert_called_once_with(date(2026, 5, 1), date(2026, 5, 31), event_type="medications")

    async def test_passes_planned_items_type_filter(self) -> None:
        client = MagicMock()
        client.async_get_calendar = AsyncMock(return_value=[])
        entity = _make_entity(DaynestPlannedCalendar, client)
        hass = MagicMock()
        await entity.async_get_events(hass, datetime(2026, 5, 1, 0, 0), datetime(2026, 5, 31, 23, 59))
        client.async_get_calendar.assert_called_once_with(date(2026, 5, 1), date(2026, 5, 31), event_type="planned_items")


@pytest.mark.unit
class TestAsyncSetupEntry:
    """Tests for calendar platform setup."""

    async def test_registers_meal_plan_calendar(self) -> None:
        entry = MagicMock()
        entry.runtime_data.coordinator = _make_coordinator()
        async_add_entities = MagicMock()

        await async_setup_entry(MagicMock(), entry, async_add_entities)

        entities = async_add_entities.call_args.args[0]
        assert any(isinstance(entity, DaynestMealPlanCalendarEntity) for entity in entities)


@pytest.mark.unit
class TestDaynestMealPlanCalendarEntity:
    """Tests for meal plan calendar events."""

    async def test_returns_meal_slot_events_from_coordinator_data(self) -> None:
        coordinator = _make_coordinator()
        coordinator.data["meal_slots"] = [
            {
                "id": 5,
                "meal_plan_id": 1,
                "slot_date": "2026-06-08",
                "slot_type": "breakfast",
                "title": "Overnight oats",
                "recipe_url": "https://recipes.example/oats",
            },
            {
                "id": 6,
                "meal_plan_id": 1,
                "slot_date": "2026-06-08",
                "slot_type": "dinner",
                "title": "Pasta",
                "recipe_url": None,
            },
        ]
        entity = DaynestMealPlanCalendarEntity(
            coordinator=coordinator,
            entity_description=EntityDescription(
                key="daynest_meal_plan_calendar",
                translation_key="daynest_meal_plan_calendar",
            ),
        )
        entity.hass = MagicMock()
        entity.hass.config.time_zone = "UTC"

        events = await entity.async_get_events(
            MagicMock(),
            datetime(2026, 6, 8, 0, 0, tzinfo=UTC),
            datetime(2026, 6, 9, 0, 0, tzinfo=UTC),
        )

        assert [event.summary for event in events] == ["Overnight oats", "Pasta"]
        assert events[0].start == datetime(2026, 6, 8, 8, 0, tzinfo=UTC)
        assert events[0].end == datetime(2026, 6, 8, 9, 0, tzinfo=UTC)
        assert events[0].uid == "meal-slot-5"
        assert events[0].description == "https://recipes.example/oats"
        assert events[1].start == datetime(2026, 6, 8, 18, 0, tzinfo=UTC)

    async def test_skips_empty_or_out_of_range_slots(self) -> None:
        coordinator = _make_coordinator()
        coordinator.data["meal_slots"] = [
            {"id": 1, "slot_date": "2026-06-08", "slot_type": "lunch", "title": ""},
            {"id": 2, "slot_date": "bad", "slot_type": "lunch", "title": "Bad date"},
            {"id": 3, "slot_date": "2026-06-09", "slot_type": "unknown", "title": "Unknown"},
            {"id": 4, "slot_date": "2026-06-10", "slot_type": "snack", "title": "Fruit"},
        ]
        entity = DaynestMealPlanCalendarEntity(
            coordinator=coordinator,
            entity_description=EntityDescription(
                key="daynest_meal_plan_calendar",
                translation_key="daynest_meal_plan_calendar",
            ),
        )
        entity.hass = MagicMock()
        entity.hass.config.time_zone = "UTC"

        events = await entity.async_get_events(
            MagicMock(),
            datetime(2026, 6, 8, 0, 0, tzinfo=UTC),
            datetime(2026, 6, 9, 0, 0, tzinfo=UTC),
        )

        assert events == []


@pytest.mark.unit
class TestDaynestCalendarEntityCreateEvent:
    """Tests for DaynestCalendarEntity.async_create_calendar_event."""

    async def test_creates_planned_item_from_date_event(self) -> None:
        client = MagicMock()
        client.async_create_planned_item = AsyncMock(return_value={"success": True, "detail": "created"})
        coordinator = _make_coordinator(client)
        coordinator.async_request_refresh = AsyncMock()
        description = EntityDescription(key="daynest_planned_calendar", translation_key="daynest_planned_calendar")
        entity = DaynestPlannedCalendar(coordinator=coordinator, entity_description=description)

        event = CalendarEvent(
            summary="Plan dinner",
            start=date(2026, 5, 20),
            end=date(2026, 5, 21),
        )
        await entity.async_create_calendar_event(event)

        client.async_create_planned_item.assert_called_once_with(
            title="Plan dinner",
            planned_for="2026-05-20",
            notes=None,
        )

    async def test_creates_planned_item_from_datetime_event(self) -> None:
        client = MagicMock()
        client.async_create_planned_item = AsyncMock(return_value={"success": True, "detail": "created"})
        coordinator = _make_coordinator(client)
        coordinator.async_request_refresh = AsyncMock()
        description = EntityDescription(key="daynest_planned_calendar", translation_key="daynest_planned_calendar")
        entity = DaynestPlannedCalendar(coordinator=coordinator, entity_description=description)

        event = CalendarEvent(
            summary="Morning run",
            start=datetime(2026, 5, 20, 7, 0, tzinfo=UTC),
            end=datetime(2026, 5, 20, 8, 0, tzinfo=UTC),
        )
        await entity.async_create_calendar_event(event)

        client.async_create_planned_item.assert_called_once_with(
            title="Morning run",
            planned_for="2026-05-20",
            notes=None,
        )

    async def test_passes_description_as_notes(self) -> None:
        client = MagicMock()
        client.async_create_planned_item = AsyncMock(return_value={"success": True, "detail": "created"})
        coordinator = _make_coordinator(client)
        coordinator.async_request_refresh = AsyncMock()
        description = EntityDescription(key="daynest_planned_calendar", translation_key="daynest_planned_calendar")
        entity = DaynestPlannedCalendar(coordinator=coordinator, entity_description=description)

        event = CalendarEvent(
            summary="Buy groceries",
            start=date(2026, 5, 21),
            end=date(2026, 5, 22),
            description="Milk and eggs",
        )
        await entity.async_create_calendar_event(event)

        call_kwargs = client.async_create_planned_item.call_args[1]
        assert call_kwargs["notes"] == "Milk and eggs"

    async def test_triggers_coordinator_refresh(self) -> None:
        client = MagicMock()
        client.async_create_planned_item = AsyncMock(return_value={"success": True, "detail": "created"})
        coordinator = _make_coordinator(client)
        coordinator.async_request_refresh = AsyncMock()
        description = EntityDescription(key="daynest_planned_calendar", translation_key="daynest_planned_calendar")
        entity = DaynestPlannedCalendar(coordinator=coordinator, entity_description=description)

        event = CalendarEvent(
            summary="Plan dinner",
            start=date(2026, 5, 20),
            end=date(2026, 5, 21),
        )
        await entity.async_create_calendar_event(event)

        coordinator.async_request_refresh.assert_called_once()
