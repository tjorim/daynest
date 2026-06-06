"""Calendar platform for Daynest scheduled events."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import TYPE_CHECKING

from daynest import DaynestError
from homeassistant.components.calendar import (
    CalendarEntity,
    CalendarEntityDescription,
    CalendarEntityFeature,
    CalendarEvent,
)
from homeassistant.util import dt as dt_util

from .const import LOGGER
from .entity import DaynestEntity

PARALLEL_UPDATES = 0

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    from .coordinator import DaynestDataUpdateCoordinator
    from .data import DaynestConfigEntry

CHORES_ENTITY_DESCRIPTION = CalendarEntityDescription(
    key="daynest_chores_calendar",
    translation_key="daynest_chores_calendar",
)
MEDICATIONS_ENTITY_DESCRIPTION = CalendarEntityDescription(
    key="daynest_medications_calendar",
    translation_key="daynest_medications_calendar",
)
PLANNED_ENTITY_DESCRIPTION = CalendarEntityDescription(
    key="daynest_planned_calendar",
    translation_key="daynest_planned_calendar",
)
MEAL_PLAN_ENTITY_DESCRIPTION = CalendarEntityDescription(
    key="daynest_meal_plan_calendar",
    translation_key="daynest_meal_plan_calendar",
)

MEAL_SLOT_START_TIMES = {
    "breakfast": time(8, 0),
    "lunch": time(12, 0),
    "dinner": time(18, 0),
    "snack": time(15, 0),
}
MEAL_SLOT_DURATION = timedelta(hours=1)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Daynest calendar entities for a config entry."""
    async_add_entities(
        [
            DaynestChoresCalendar(
                coordinator=entry.runtime_data.coordinator,
                entity_description=CHORES_ENTITY_DESCRIPTION,
            ),
            DaynestMedicationsCalendar(
                coordinator=entry.runtime_data.coordinator,
                entity_description=MEDICATIONS_ENTITY_DESCRIPTION,
            ),
            DaynestPlannedCalendar(
                coordinator=entry.runtime_data.coordinator,
                entity_description=PLANNED_ENTITY_DESCRIPTION,
            ),
            DaynestMealPlanCalendarEntity(
                coordinator=entry.runtime_data.coordinator,
                entity_description=MEAL_PLAN_ENTITY_DESCRIPTION,
            ),
        ]
    )


def _parse_event(raw: dict) -> CalendarEvent | None:
    """Parse a backend event dict into a HA CalendarEvent."""
    try:
        summary = str(raw.get("summary") or "Event")
        uid = raw.get("uid")
        description = raw.get("description") or None

        start_obj = raw.get("start", {})
        end_obj = raw.get("end", {})

        if "dateTime" in start_obj:
            start: date | datetime = datetime.fromisoformat(start_obj["dateTime"])
            end: date | datetime = datetime.fromisoformat(end_obj["dateTime"])
            if isinstance(start, datetime) and start.tzinfo is None:
                start = start.replace(tzinfo=UTC)
            if isinstance(end, datetime) and end.tzinfo is None:
                end = end.replace(tzinfo=UTC)
        else:
            start = date.fromisoformat(start_obj["date"])
            end = date.fromisoformat(end_obj["date"])

        return CalendarEvent(
            summary=summary,
            start=start,
            end=end,
            uid=uid,
            description=description,
        )
    except (KeyError, ValueError, TypeError) as exc:
        LOGGER.warning("Failed to parse calendar event %r: %s", raw, exc)
        return None


class DaynestCalendarEntity(CalendarEntity, DaynestEntity):
    """Expose Daynest scheduled events as a Home Assistant calendar."""

    _attr_supported_features = CalendarEntityFeature.CREATE_EVENT

    def __init__(
        self,
        coordinator: DaynestDataUpdateCoordinator,
        entity_description: CalendarEntityDescription,
    ) -> None:
        """Initialize the calendar entity."""
        super().__init__(coordinator, entity_description)

    @property
    def event(self) -> CalendarEvent | None:
        """Return the next upcoming event.

        Returns None — HA fetches events via async_get_events for calendar display.
        """
        return None

    async def async_get_events(
        self,
        hass: HomeAssistant,
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> list[CalendarEvent]:
        """Return all Daynest events in the requested date range."""
        client = self.coordinator.config_entry.runtime_data.client
        start = start_datetime.date()
        end = end_datetime.date()

        try:
            raw_events = await client.async_get_calendar(start, end, event_type=self._event_type)
        except DaynestError as err:
            LOGGER.warning("Failed to fetch Daynest calendar events: %s", err)
            return []

        events = []
        for raw in raw_events:
            parsed = _parse_event(raw)
            if parsed is not None:
                events.append(parsed)
        return events

    async def async_create_calendar_event(self, event: CalendarEvent) -> None:
        """Create a Daynest planned item from a calendar event."""
        client = self.coordinator.config_entry.runtime_data.client
        planned_for = event.start.date() if isinstance(event.start, datetime) else event.start
        await client.async_create_planned_item(
            title=event.summary or "Event",
            planned_for=planned_for.isoformat(),
            notes=event.description,
        )
        await self.coordinator.async_request_refresh()


class DaynestChoresCalendar(DaynestCalendarEntity):
    """Calendar view for chore and routine events."""

    _event_type = "chores"
    _attr_supported_features = CalendarEntityFeature(0)


class DaynestMedicationsCalendar(DaynestCalendarEntity):
    """Calendar view for medication events."""

    _event_type = "medications"
    _attr_supported_features = CalendarEntityFeature(0)


class DaynestPlannedCalendar(DaynestCalendarEntity):
    """Calendar view for planned items."""

    _event_type = "planned_items"


def _parse_iso_date(value: object) -> date | None:
    """Parse an ISO date object for meal slot mapping."""
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


class DaynestMealPlanCalendarEntity(CalendarEntity, DaynestEntity):
    """Calendar view for meal plan slots."""

    _attr_supported_features = CalendarEntityFeature(0)

    def __init__(
        self,
        coordinator: DaynestDataUpdateCoordinator,
        entity_description: CalendarEntityDescription,
    ) -> None:
        """Initialize the meal plan calendar entity."""
        super().__init__(coordinator, entity_description)

    @property
    def event(self) -> CalendarEvent | None:
        """Return the next upcoming meal event if available."""
        now = datetime.now(UTC)
        future_events = [event for event in self._meal_slot_events(now, now + timedelta(days=14)) if event.start >= now]
        return min(future_events, key=lambda event: event.start) if future_events else None

    async def async_get_events(
        self,
        hass: HomeAssistant,
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> list[CalendarEvent]:
        """Return meal slot events from coordinator data in the requested range."""
        return self._meal_slot_events(start_datetime, end_datetime)

    def _meal_slot_events(self, start_datetime: datetime, end_datetime: datetime) -> list[CalendarEvent]:
        local_tz = dt_util.get_time_zone(self.hass.config.time_zone) or UTC
        range_start = start_datetime if start_datetime.tzinfo is not None else start_datetime.replace(tzinfo=local_tz)
        range_end = end_datetime if end_datetime.tzinfo is not None else end_datetime.replace(tzinfo=local_tz)
        events: list[CalendarEvent] = []
        for slot in self.coordinator.data.get("meal_slots", []):
            if not isinstance(slot, dict):
                continue
            title = str(slot.get("title") or "").strip()
            if not title:
                continue
            slot_date = _parse_iso_date(slot.get("slot_date"))
            if slot_date is None:
                continue
            slot_type = str(slot.get("slot_type") or "").lower()
            start_time = MEAL_SLOT_START_TIMES.get(slot_type)
            if start_time is None:
                continue
            event_start = datetime.combine(slot_date, start_time, tzinfo=local_tz)
            event_end = event_start + MEAL_SLOT_DURATION
            if event_end <= range_start or event_start >= range_end:
                continue
            slot_id = slot.get("id")
            events.append(
                CalendarEvent(
                    summary=title,
                    start=event_start,
                    end=event_end,
                    uid=f"meal-slot-{slot_id}" if slot_id is not None else None,
                    description=slot.get("recipe_url") if isinstance(slot.get("recipe_url"), str) else None,
                )
            )
        return events
