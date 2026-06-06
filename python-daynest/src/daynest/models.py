"""Daynest API response models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any, Generic, TypeVar
from uuid import UUID

from daynest.exceptions import DaynestMalformedResponseError


@dataclass(slots=True, frozen=True)
class DaynestSummary:
    """Typed model for the ``/summary`` payload."""

    payload: dict[str, Any]

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> DaynestSummary:
        """Build a typed summary model from a raw JSON payload."""
        if not isinstance(payload, dict):
            msg = "Malformed summary payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        required_keys = {
            "sensor_daynest_chores_due",
            "sensor_daynest_routines_open",
            "sensor_daynest_medication_due",
            "sensor_daynest_planned_remaining",
            "sensor_daynest_overdue_count",
            "sensor_daynest_next_medication",
        }
        missing_keys = sorted(required_keys.difference(payload))
        if missing_keys:
            missing = ", ".join(missing_keys)
            msg = f"Malformed summary payload: missing required keys ({missing})"
            raise DaynestMalformedResponseError(msg)
        return cls(payload=payload)


@dataclass(slots=True, frozen=True)
class DaynestDashboard:
    """Typed model for the ``/dashboard`` payload."""

    payload: dict[str, Any]

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> DaynestDashboard:
        """Build a typed dashboard model from a raw JSON payload."""
        if not isinstance(payload, dict):
            msg = "Malformed dashboard payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        required_keys = {
            "for_date",
            "due_today_count",
            "overdue_count",
            "planned_count",
            "medication_due_count",
            "completion_ratio",
            "next_medication",
        }
        missing_keys = sorted(required_keys.difference(payload))
        if missing_keys:
            missing = ", ".join(missing_keys)
            msg = f"Malformed dashboard payload: missing required keys ({missing})"
            raise DaynestMalformedResponseError(msg)
        return cls(payload=payload)


ModelT = TypeVar("ModelT")


@dataclass(slots=True, frozen=True)
class DaynestApiResponse(Generic[ModelT]):
    """Typed response wrapper carrying contract metadata."""

    data: ModelT
    integration_contract: str | None


def _parse_date(value: Any, *, field: str) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as err:
            msg = f"Malformed {field}: expected ISO date"
            raise DaynestMalformedResponseError(msg) from err
    msg = f"Malformed {field}: expected ISO date"
    raise DaynestMalformedResponseError(msg)


def _parse_datetime(value: Any, *, field: str) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError as err:
            msg = f"Malformed {field}: expected ISO datetime"
            raise DaynestMalformedResponseError(msg) from err
    msg = f"Malformed {field}: expected ISO datetime"
    raise DaynestMalformedResponseError(msg)


def _parse_time(value: Any, *, field: str) -> time:
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        try:
            return time.fromisoformat(value)
        except ValueError as err:
            msg = f"Malformed {field}: expected ISO time"
            raise DaynestMalformedResponseError(msg) from err
    msg = f"Malformed {field}: expected ISO time"
    raise DaynestMalformedResponseError(msg)


def _require(payload: dict[str, Any], key: str, *, context: str) -> Any:
    try:
        return payload[key]
    except KeyError as err:
        msg = f"Malformed {context} payload: missing required key ({key})"
        raise DaynestMalformedResponseError(msg) from err


@dataclass(slots=True, frozen=True)
class PlannedItem:
    """Typed model for a planned item."""

    id: int
    title: str
    planned_for: date
    notes: str | None
    module_key: str | None
    recurrence_hint: str | None
    rrule: str | None
    recurrence_series_id: UUID | None
    linked_source: str | None
    linked_ref: str | None
    priority: str
    tags: tuple[str, ...]
    is_done: bool

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> PlannedItem:
        if not isinstance(payload, dict):
            msg = "Malformed planned item payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        tags = payload.get("tags")
        tag_values = tuple(str(item) for item in tags) if isinstance(tags, list) else ()
        recurrence_series_id = payload.get("recurrence_series_id")
        parsed_series_id: UUID | None = None
        if recurrence_series_id is not None:
            if not isinstance(recurrence_series_id, str):
                msg = "Malformed planned item payload: recurrence_series_id must be a string"
                raise DaynestMalformedResponseError(msg)
            try:
                parsed_series_id = UUID(recurrence_series_id)
            except ValueError as err:
                msg = "Malformed planned item payload: recurrence_series_id must be a UUID"
                raise DaynestMalformedResponseError(msg) from err
        return cls(
            id=int(_require(payload, "id", context="planned item")),
            title=str(_require(payload, "title", context="planned item")),
            planned_for=_parse_date(_require(payload, "planned_for", context="planned item"), field="planned_for"),
            notes=payload.get("notes") if isinstance(payload.get("notes"), str) else None,
            module_key=payload.get("module_key") if isinstance(payload.get("module_key"), str) else None,
            recurrence_hint=payload.get("recurrence_hint") if isinstance(payload.get("recurrence_hint"), str) else None,
            rrule=payload.get("rrule") if isinstance(payload.get("rrule"), str) else None,
            recurrence_series_id=parsed_series_id,
            linked_source=payload.get("linked_source") if isinstance(payload.get("linked_source"), str) else None,
            linked_ref=payload.get("linked_ref") if isinstance(payload.get("linked_ref"), str) else None,
            priority=str(payload.get("priority", "normal")),
            tags=tag_values,
            is_done=bool(payload.get("is_done")),
        )


@dataclass(slots=True, frozen=True)
class MealPlan:
    """Typed model for a meal plan."""

    id: int
    user_id: int
    name: str
    week_start: date
    notes: str | None
    created_at: datetime

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> MealPlan:
        if not isinstance(payload, dict):
            msg = "Malformed meal plan payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        return cls(
            id=int(_require(payload, "id", context="meal plan")),
            user_id=int(_require(payload, "user_id", context="meal plan")),
            name=str(_require(payload, "name", context="meal plan")),
            week_start=_parse_date(_require(payload, "week_start", context="meal plan"), field="week_start"),
            notes=payload.get("notes") if isinstance(payload.get("notes"), str) else None,
            created_at=_parse_datetime(_require(payload, "created_at", context="meal plan"), field="created_at"),
        )


@dataclass(slots=True, frozen=True)
class MealSlot:
    """Typed model for a meal plan slot."""

    id: int
    meal_plan_id: int
    slot_date: date
    slot_type: str
    title: str
    recipe_url: str | None
    ingredients_json: tuple[str, ...]
    planned_item_id: int | None

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> MealSlot:
        if not isinstance(payload, dict):
            msg = "Malformed meal slot payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        ingredients = payload.get("ingredients_json")
        ingredient_values = tuple(str(item) for item in ingredients) if isinstance(ingredients, list) else ()
        planned_item_id_raw = payload.get("planned_item_id")
        if planned_item_id_raw is not None:
            try:
                planned_item_id: int | None = int(planned_item_id_raw)
            except (ValueError, TypeError) as err:
                msg = "Malformed meal slot: planned_item_id is not a valid integer"
                raise DaynestMalformedResponseError(msg) from err
        else:
            planned_item_id = None
        return cls(
            id=int(_require(payload, "id", context="meal slot")),
            meal_plan_id=int(_require(payload, "meal_plan_id", context="meal slot")),
            slot_date=_parse_date(_require(payload, "slot_date", context="meal slot"), field="slot_date"),
            slot_type=str(_require(payload, "slot_type", context="meal slot")),
            title=str(payload.get("title", "")),
            recipe_url=payload.get("recipe_url") if isinstance(payload.get("recipe_url"), str) else None,
            ingredients_json=ingredient_values,
            planned_item_id=planned_item_id,
        )


@dataclass(slots=True, frozen=True)
class RoutineTemplate:
    """Typed model for a routine template."""

    id: int
    name: str
    description: str | None
    start_date: date
    every_n_days: int
    rrule: str | None
    due_time: time | None
    is_active: bool
    created_at: datetime

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> RoutineTemplate:
        if not isinstance(payload, dict):
            msg = "Malformed routine template payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        due_time = payload.get("due_time")
        return cls(
            id=int(_require(payload, "id", context="routine template")),
            name=str(_require(payload, "name", context="routine template")),
            description=payload.get("description") if isinstance(payload.get("description"), str) else None,
            start_date=_parse_date(_require(payload, "start_date", context="routine template"), field="start_date"),
            every_n_days=int(_require(payload, "every_n_days", context="routine template")),
            rrule=payload.get("rrule") if isinstance(payload.get("rrule"), str) else None,
            due_time=_parse_time(due_time, field="due_time") if due_time is not None else None,
            is_active=bool(payload.get("is_active", True)),
            created_at=_parse_datetime(_require(payload, "created_at", context="routine template"), field="created_at"),
        )


@dataclass(slots=True, frozen=True)
class ChoreTemplate:
    """Typed model for a chore template."""

    id: int
    name: str
    description: str | None
    start_date: date
    every_n_days: int
    rrule: str | None
    priority: str
    tags: tuple[str, ...]
    is_active: bool
    created_at: datetime

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> ChoreTemplate:
        if not isinstance(payload, dict):
            msg = "Malformed chore template payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        tags = payload.get("tags")
        tag_values = tuple(str(item) for item in tags) if isinstance(tags, list) else ()
        return cls(
            id=int(_require(payload, "id", context="chore template")),
            name=str(_require(payload, "name", context="chore template")),
            description=payload.get("description") if isinstance(payload.get("description"), str) else None,
            start_date=_parse_date(_require(payload, "start_date", context="chore template"), field="start_date"),
            every_n_days=int(_require(payload, "every_n_days", context="chore template")),
            rrule=payload.get("rrule") if isinstance(payload.get("rrule"), str) else None,
            priority=str(payload.get("priority", "normal")),
            tags=tag_values,
            is_active=bool(payload.get("is_active", True)),
            created_at=_parse_datetime(_require(payload, "created_at", context="chore template"), field="created_at"),
        )


@dataclass(slots=True, frozen=True)
class CalendarEvent:
    """Typed model for a calendar day item."""

    item_type: str
    item_id: int
    title: str
    status: str
    scheduled_at: datetime | None
    scheduled_date: date | None
    detail: str | None
    module_key: str | None
    recurrence_hint: str | None
    linked_source: str | None
    linked_ref: str | None
    priority: str

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> CalendarEvent:
        if not isinstance(payload, dict):
            msg = "Malformed calendar event payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        scheduled_at_raw = payload.get("scheduled_at")
        scheduled_date_raw = payload.get("scheduled_date")
        return cls(
            item_type=str(_require(payload, "item_type", context="calendar event")),
            item_id=int(_require(payload, "item_id", context="calendar event")),
            title=str(_require(payload, "title", context="calendar event")),
            status=str(payload.get("status", "")),
            scheduled_at=_parse_datetime(scheduled_at_raw, field="scheduled_at") if scheduled_at_raw is not None else None,
            scheduled_date=_parse_date(scheduled_date_raw, field="scheduled_date") if scheduled_date_raw is not None else None,
            detail=payload.get("detail") if isinstance(payload.get("detail"), str) else None,
            module_key=payload.get("module_key") if isinstance(payload.get("module_key"), str) else None,
            recurrence_hint=payload.get("recurrence_hint") if isinstance(payload.get("recurrence_hint"), str) else None,
            linked_source=payload.get("linked_source") if isinstance(payload.get("linked_source"), str) else None,
            linked_ref=payload.get("linked_ref") if isinstance(payload.get("linked_ref"), str) else None,
            priority=str(payload.get("priority", "normal")),
        )


@dataclass(slots=True, frozen=True)
class CalendarDay:
    """Typed model for day and month calendar payloads."""

    date: date
    items: tuple[CalendarEvent, ...]
    total: int
    routines: int | None = None
    chores: int | None = None
    medications: int | None = None
    planned: int | None = None

    @classmethod
    def from_day_dict(cls, payload: dict[str, Any]) -> CalendarDay:
        if not isinstance(payload, dict):
            msg = "Malformed calendar day payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        raw_items = payload.get("items")
        if not isinstance(raw_items, list):
            msg = "Malformed calendar day payload: expected items array"
            raise DaynestMalformedResponseError(msg)
        events: list[CalendarEvent] = []
        for item in raw_items:
            if isinstance(item, dict):
                events.append(CalendarEvent.from_dict(item))
        return cls(
            date=_parse_date(_require(payload, "date", context="calendar day"), field="date"),
            items=tuple(events),
            total=len(events),
            routines=None,
            chores=None,
            medications=None,
            planned=None,
        )

    @classmethod
    def from_month_summary_dict(cls, payload: dict[str, Any]) -> CalendarDay:
        if not isinstance(payload, dict):
            msg = "Malformed calendar month day payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        return cls(
            date=_parse_date(_require(payload, "date", context="calendar month day"), field="date"),
            items=tuple(),
            total=int(payload.get("total", 0)),
            routines=int(payload.get("routines", 0)),
            chores=int(payload.get("chores", 0)),
            medications=int(payload.get("medications", 0)),
            planned=int(payload.get("planned", 0)),
        )
