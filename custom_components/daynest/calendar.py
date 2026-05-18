"""Calendar platform for Daynest scheduled events."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import TYPE_CHECKING

from daynest import DaynestError
from homeassistant.components.calendar import CalendarEntity, CalendarEntityFeature, CalendarEvent
from homeassistant.helpers.entity import EntityDescription

from .const import LOGGER
from .entity import DaynestEntity

PARALLEL_UPDATES = 0

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    from .coordinator import DaynestDataUpdateCoordinator
    from .data import DaynestConfigEntry

ENTITY_DESCRIPTION = EntityDescription(
    key="daynest_calendar",
    translation_key="daynest_calendar",
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Daynest calendar entity for a config entry."""
    async_add_entities(
        [
            DaynestCalendarEntity(
                coordinator=entry.runtime_data.coordinator,
                entity_description=ENTITY_DESCRIPTION,
            )
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

    _attr_icon = "mdi:calendar-check"
    _attr_supported_features = CalendarEntityFeature.CREATE_EVENT

    def __init__(
        self,
        coordinator: DaynestDataUpdateCoordinator,
        entity_description: EntityDescription,
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
            raw_events = await client.async_get_calendar(start, end)
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
