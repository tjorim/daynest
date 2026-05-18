"""Unit tests for custom_components.daynest.calendar."""

from __future__ import annotations

from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from daynest.api.client import DaynestApiClientError
from daynest.calendar import DaynestCalendarEntity, _parse_event
from homeassistant.components.calendar import CalendarEvent
from homeassistant.helpers.entity import EntityDescription


def _make_coordinator(client: MagicMock | None = None) -> MagicMock:
    coordinator = MagicMock()
    coordinator.data = {"model": "Unknown"}
    coordinator.config_entry.entry_id = "test_entry_id"
    coordinator.config_entry.domain = "daynest"
    coordinator.config_entry.title = "Daynest Test"
    coordinator.config_entry.runtime_data.client = client or MagicMock()
    return coordinator


def _make_entity(client: MagicMock | None = None) -> DaynestCalendarEntity:
    coordinator = _make_coordinator(client)
    description = EntityDescription(key="daynest_calendar", translation_key="daynest_calendar")
    return DaynestCalendarEntity(coordinator=coordinator, entity_description=description)


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
        entity = _make_entity(client)
        hass = MagicMock()
        start = datetime(2026, 5, 17, 0, 0)
        end = datetime(2026, 5, 17, 23, 59)

        events = await entity.async_get_events(hass, start, end)

        assert len(events) == 2
        assert events[0].summary == "Clean kitchen"
        assert events[1].summary == "Vitamin D"

    async def test_api_error_returns_empty_list(self) -> None:
        client = MagicMock()
        client.async_get_calendar = AsyncMock(side_effect=DaynestApiClientError("network fail"))
        entity = _make_entity(client)
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
        entity = _make_entity(client)
        hass = MagicMock()

        events = await entity.async_get_events(hass, datetime(2026, 5, 1), datetime(2026, 5, 31))

        assert len(events) == 1
        assert events[0].summary == "Good"

    async def test_passes_date_range_to_client(self) -> None:
        client = MagicMock()
        client.async_get_calendar = AsyncMock(return_value=[])
        entity = _make_entity(client)
        hass = MagicMock()

        await entity.async_get_events(hass, datetime(2026, 5, 1, 0, 0), datetime(2026, 5, 31, 23, 59))

        client.async_get_calendar.assert_called_once_with(date(2026, 5, 1), date(2026, 5, 31))


@pytest.mark.unit
class TestDaynestCalendarEntityCreateEvent:
    """Tests for DaynestCalendarEntity.async_create_calendar_event."""

    async def test_creates_planned_item_from_date_event(self) -> None:
        client = MagicMock()
        client.async_create_planned_item = AsyncMock(return_value={"success": True, "detail": "created"})
        coordinator = _make_coordinator(client)
        coordinator.async_request_refresh = AsyncMock()
        description = EntityDescription(key="daynest_calendar", translation_key="daynest_calendar")
        entity = DaynestCalendarEntity(coordinator=coordinator, entity_description=description)

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
        description = EntityDescription(key="daynest_calendar", translation_key="daynest_calendar")
        entity = DaynestCalendarEntity(coordinator=coordinator, entity_description=description)

        event = CalendarEvent(
            summary="Morning run",
            start=datetime(2026, 5, 20, 7, 0),
            end=datetime(2026, 5, 20, 8, 0),
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
        description = EntityDescription(key="daynest_calendar", translation_key="daynest_calendar")
        entity = DaynestCalendarEntity(coordinator=coordinator, entity_description=description)

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
        description = EntityDescription(key="daynest_calendar", translation_key="daynest_calendar")
        entity = DaynestCalendarEntity(coordinator=coordinator, entity_description=description)

        event = CalendarEvent(
            summary="Plan dinner",
            start=date(2026, 5, 20),
            end=date(2026, 5, 21),
        )
        await entity.async_create_calendar_event(event)

        coordinator.async_request_refresh.assert_called_once()
