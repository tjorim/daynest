from __future__ import annotations

import csv
import enum
import json
from collections.abc import Iterable, Mapping
from datetime import date, datetime, time, timezone
from io import StringIO
from typing import Any, NoReturn, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.enums import ChoreStatus, MedicationDoseStatus, Priority, TaskStatus
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
from app.models.routine_template import RoutineTemplate
from app.models.task_instance import TaskInstance
from app.models.user import User

_E = TypeVar("_E", bound=enum.Enum)

EXPORT_VERSION = 1

_USER_SETTING_FIELDS = (
    "timezone",
    "default_snooze_days",
    "medication_reminder_minutes",
    "quiet_hours_start",
    "quiet_hours_end",
)
_ROUTINE_TEMPLATE_FIELDS = (
    "id",
    "name",
    "description",
    "start_date",
    "every_n_days",
    "rrule",
    "due_time",
    "is_active",
    "created_at",
)
_CHORE_TEMPLATE_FIELDS = (
    "id",
    "name",
    "description",
    "start_date",
    "every_n_days",
    "rrule",
    "priority",
    "tags",
    "is_active",
    "created_at",
)
_MEDICATION_PLAN_FIELDS = (
    "id",
    "name",
    "instructions",
    "start_date",
    "schedule_time",
    "every_n_days",
    "is_active",
    "created_at",
)
_TASK_INSTANCE_FIELDS = (
    "id",
    "routine_template_id",
    "title",
    "scheduled_date",
    "due_at",
    "status",
    "completed_at",
    "created_at",
)
_CHORE_INSTANCE_FIELDS = (
    "id",
    "chore_template_id",
    "title",
    "scheduled_date",
    "status",
    "completed_at",
    "skipped_at",
    "created_at",
)
_MEDICATION_DOSE_FIELDS = (
    "id",
    "medication_plan_id",
    "name",
    "instructions",
    "scheduled_date",
    "scheduled_at",
    "status",
    "taken_at",
    "skipped_at",
    "missed_at",
    "created_at",
)
_PLANNED_ITEM_FIELDS = (
    "id",
    "title",
    "notes",
    "module_key",
    "recurrence_hint",
    "linked_source",
    "linked_ref",
    "planned_for",
    "priority",
    "tags",
    "is_done",
    "completed_at",
    "created_at",
)


def build_user_export(db: Session, user: User) -> dict[str, Any]:
    return {
        "version": EXPORT_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_settings": _fields_to_dict(user, _USER_SETTING_FIELDS),
        "routine_templates": _export_rows(
            db.query(RoutineTemplate).filter(RoutineTemplate.user_id == user.id).order_by(RoutineTemplate.id).all(),
            _ROUTINE_TEMPLATE_FIELDS,
        ),
        "chore_templates": _export_rows(
            db.query(ChoreTemplate).filter(ChoreTemplate.user_id == user.id).order_by(ChoreTemplate.id).all(),
            _CHORE_TEMPLATE_FIELDS,
        ),
        "medication_plans": _export_rows(
            db.query(MedicationPlan).filter(MedicationPlan.user_id == user.id).order_by(MedicationPlan.id).all(),
            _MEDICATION_PLAN_FIELDS,
        ),
        "task_instances": _export_rows(
            db.query(TaskInstance).filter(TaskInstance.user_id == user.id).order_by(TaskInstance.id).all(),
            _TASK_INSTANCE_FIELDS,
        ),
        "chore_instances": _export_rows(
            db.query(ChoreInstance).filter(ChoreInstance.user_id == user.id).order_by(ChoreInstance.id).all(),
            _CHORE_INSTANCE_FIELDS,
        ),
        "medication_dose_instances": _export_rows(
            db.query(MedicationDoseInstance)
            .filter(MedicationDoseInstance.user_id == user.id)
            .order_by(MedicationDoseInstance.id)
            .all(),
            _MEDICATION_DOSE_FIELDS,
        ),
        "planned_items": _export_rows(
            db.query(PlannedItem).filter(PlannedItem.user_id == user.id).order_by(PlannedItem.id).all(),
            _PLANNED_ITEM_FIELDS,
        ),
    }


def user_export_to_csv(payload: Mapping[str, Any]) -> str:
    rows: list[dict[str, Any]] = []
    settings = payload.get("user_settings")
    if isinstance(settings, Mapping):
        rows.append({"table": "user_settings", **settings})

    for table in (
        "routine_templates",
        "chore_templates",
        "medication_plans",
        "task_instances",
        "chore_instances",
        "medication_dose_instances",
        "planned_items",
    ):
        values = payload.get(table)
        if isinstance(values, list):
            rows.extend({"table": table, **row} for row in values if isinstance(row, Mapping))

    fieldnames = ["table", *sorted({key for row in rows for key in row if key != "table"})]
    out = StringIO()
    writer = csv.DictWriter(out, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: _csv_value(row.get(key)) for key in fieldnames})
    return out.getvalue()


def import_user_export(db: Session, user: User, payload: Mapping[str, Any], *, replace: bool = False) -> dict[str, int]:
    if payload.get("version") != EXPORT_VERSION:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported export version: {payload.get('version')}",
        )

    if replace:
        _delete_user_data(db, user.id)

    settings = _mapping(payload.get("user_settings"), "user_settings")
    for field in _USER_SETTING_FIELDS:
        if field in settings:
            setattr(user, field, _coerce_setting(field, settings[field]))

    routine_id_map: dict[int, int] = {}
    chore_id_map: dict[int, int] = {}
    medication_id_map: dict[int, int] = {}

    counts = {
        "routine_templates": 0,
        "chore_templates": 0,
        "medication_plans": 0,
        "task_instances": 0,
        "chore_instances": 0,
        "medication_dose_instances": 0,
        "planned_items": 0,
    }

    for row in _rows(payload, "routine_templates"):
        old_id = _int(row.get("id"), "routine_templates.id")
        item = RoutineTemplate(
            user_id=user.id,
            name=_str(row.get("name"), "routine_templates.name"),
            description=_nullable_str(row.get("description"), "routine_templates.description"),
            start_date=_date(row.get("start_date"), "routine_templates.start_date"),
            every_n_days=_int(row.get("every_n_days"), "routine_templates.every_n_days"),
            rrule=_nullable_str(row.get("rrule"), "routine_templates.rrule"),
            due_time=_nullable_time(row.get("due_time"), "routine_templates.due_time"),
            is_active=_bool(row.get("is_active"), "routine_templates.is_active"),
            created_at=_datetime(row.get("created_at"), "routine_templates.created_at"),
        )
        db.add(item)
        db.flush()
        routine_id_map[old_id] = item.id
        counts["routine_templates"] += 1

    for row in _rows(payload, "chore_templates"):
        old_id = _int(row.get("id"), "chore_templates.id")
        item = ChoreTemplate(
            user_id=user.id,
            name=_str(row.get("name"), "chore_templates.name"),
            description=_nullable_str(row.get("description"), "chore_templates.description"),
            start_date=_date(row.get("start_date"), "chore_templates.start_date"),
            every_n_days=_int(row.get("every_n_days"), "chore_templates.every_n_days"),
            rrule=_nullable_str(row.get("rrule"), "chore_templates.rrule"),
            priority=_enum(Priority, row.get("priority", Priority.normal.value), "chore_templates.priority"),
            tags=_list(row.get("tags"), "chore_templates.tags"),
            is_active=_bool(row.get("is_active"), "chore_templates.is_active"),
            created_at=_datetime(row.get("created_at"), "chore_templates.created_at"),
        )
        db.add(item)
        db.flush()
        chore_id_map[old_id] = item.id
        counts["chore_templates"] += 1

    for row in _rows(payload, "medication_plans"):
        old_id = _int(row.get("id"), "medication_plans.id")
        item = MedicationPlan(
            user_id=user.id,
            name=_str(row.get("name"), "medication_plans.name"),
            instructions=_str(row.get("instructions"), "medication_plans.instructions"),
            start_date=_date(row.get("start_date"), "medication_plans.start_date"),
            schedule_time=_time(row.get("schedule_time"), "medication_plans.schedule_time"),
            every_n_days=_int(row.get("every_n_days"), "medication_plans.every_n_days"),
            is_active=_bool(row.get("is_active"), "medication_plans.is_active"),
            created_at=_datetime(row.get("created_at"), "medication_plans.created_at"),
        )
        db.add(item)
        db.flush()
        medication_id_map[old_id] = item.id
        counts["medication_plans"] += 1

    for row in _rows(payload, "task_instances"):
        item = TaskInstance(
            user_id=user.id,
            routine_template_id=_mapped_id(routine_id_map, row.get("routine_template_id"), "task_instances.routine_template_id"),
            title=_str(row.get("title"), "task_instances.title"),
            scheduled_date=_date(row.get("scheduled_date"), "task_instances.scheduled_date"),
            due_at=_nullable_datetime(row.get("due_at"), "task_instances.due_at"),
            status=_enum(TaskStatus, row.get("status"), "task_instances.status"),
            completed_at=_nullable_datetime(row.get("completed_at"), "task_instances.completed_at"),
            created_at=_datetime(row.get("created_at"), "task_instances.created_at"),
        )
        db.add(item)
        counts["task_instances"] += 1

    for row in _rows(payload, "chore_instances"):
        item = ChoreInstance(
            user_id=user.id,
            chore_template_id=_mapped_id(chore_id_map, row.get("chore_template_id"), "chore_instances.chore_template_id"),
            title=_str(row.get("title"), "chore_instances.title"),
            scheduled_date=_date(row.get("scheduled_date"), "chore_instances.scheduled_date"),
            status=_enum(ChoreStatus, row.get("status"), "chore_instances.status"),
            completed_at=_nullable_datetime(row.get("completed_at"), "chore_instances.completed_at"),
            skipped_at=_nullable_datetime(row.get("skipped_at"), "chore_instances.skipped_at"),
            created_at=_datetime(row.get("created_at"), "chore_instances.created_at"),
        )
        db.add(item)
        counts["chore_instances"] += 1

    for row in _rows(payload, "medication_dose_instances"):
        item = MedicationDoseInstance(
            user_id=user.id,
            medication_plan_id=_mapped_id(
                medication_id_map,
                row.get("medication_plan_id"),
                "medication_dose_instances.medication_plan_id",
            ),
            name=_str(row.get("name"), "medication_dose_instances.name"),
            instructions=_str(row.get("instructions"), "medication_dose_instances.instructions"),
            scheduled_date=_date(row.get("scheduled_date"), "medication_dose_instances.scheduled_date"),
            scheduled_at=_datetime(row.get("scheduled_at"), "medication_dose_instances.scheduled_at"),
            status=_enum(MedicationDoseStatus, row.get("status"), "medication_dose_instances.status"),
            taken_at=_nullable_datetime(row.get("taken_at"), "medication_dose_instances.taken_at"),
            skipped_at=_nullable_datetime(row.get("skipped_at"), "medication_dose_instances.skipped_at"),
            missed_at=_nullable_datetime(row.get("missed_at"), "medication_dose_instances.missed_at"),
            created_at=_datetime(row.get("created_at"), "medication_dose_instances.created_at"),
        )
        db.add(item)
        counts["medication_dose_instances"] += 1

    for row in _rows(payload, "planned_items"):
        item = PlannedItem(
            user_id=user.id,
            title=_str(row.get("title"), "planned_items.title"),
            notes=_nullable_str(row.get("notes"), "planned_items.notes"),
            module_key=_nullable_str(row.get("module_key"), "planned_items.module_key"),
            recurrence_hint=_nullable_str(row.get("recurrence_hint"), "planned_items.recurrence_hint"),
            linked_source=_nullable_str(row.get("linked_source"), "planned_items.linked_source"),
            linked_ref=_nullable_str(row.get("linked_ref"), "planned_items.linked_ref"),
            planned_for=_date(row.get("planned_for"), "planned_items.planned_for"),
            priority=_enum(Priority, row.get("priority", Priority.normal.value), "planned_items.priority"),
            tags=_list(row.get("tags"), "planned_items.tags"),
            is_done=_bool(row.get("is_done"), "planned_items.is_done"),
            completed_at=_nullable_datetime(row.get("completed_at"), "planned_items.completed_at"),
            created_at=_datetime(row.get("created_at"), "planned_items.created_at"),
        )
        db.add(item)
        counts["planned_items"] += 1

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Import conflicts with existing data: {exc.orig}",
        ) from exc
    return counts


def _delete_user_data(db: Session, user_id: int) -> None:
    for model in (
        MedicationDoseInstance,
        ChoreInstance,
        TaskInstance,
        PlannedItem,
        MedicationPlan,
        ChoreTemplate,
        RoutineTemplate,
    ):
        db.execute(delete(model).where(model.user_id == user_id))


def _export_rows(rows: Iterable[Any], fields: tuple[str, ...]) -> list[dict[str, Any]]:
    return [_fields_to_dict(row, fields) for row in rows]


def _fields_to_dict(row: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    return {field: _json_value(getattr(row, field)) for field in fields}


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime | date | time):
        return value.isoformat()
    if hasattr(value, "value"):
        return value.value
    return value


def _csv_value(value: Any) -> Any:
    if isinstance(value, list | dict):
        return json.dumps(value, separators=(",", ":"))
    return value


def _rows(payload: Mapping[str, Any], key: str) -> list[Mapping[str, Any]]:
    values = payload.get(key, [])
    if not isinstance(values, list):
        _invalid(f"{key} must be a list")
    return [_mapping(value, key) for value in values]


def _mapping(value: Any, field: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        _invalid(f"{field} must be an object")
    return value


def _mapped_id(mapping: Mapping[int, int], value: Any, field: str) -> int:
    old_id = _int(value, field)
    if old_id not in mapping:
        _invalid(f"{field} references an item missing from this import")
    return mapping[old_id]


def _coerce_setting(field: str, value: Any) -> Any:
    if field in {"timezone"}:
        return _str(value, f"user_settings.{field}")
    if field in {"default_snooze_days", "medication_reminder_minutes"}:
        return _int(value, f"user_settings.{field}")
    return _nullable_time(value, f"user_settings.{field}")


def _str(value: Any, field: str) -> str:
    if not isinstance(value, str):
        _invalid(f"{field} must be a string")
    return value


def _nullable_str(value: Any, field: str) -> str | None:
    if value is None:
        return None
    return _str(value, field)


def _int(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        _invalid(f"{field} must be an integer")
    return value


def _bool(value: Any, field: str) -> bool:
    if not isinstance(value, bool):
        _invalid(f"{field} must be a boolean")
    return value


def _enum(cls: type[_E], value: Any, field: str) -> _E:
    s = _str(value, field)
    try:
        return cls(s)  # type: ignore[call-arg]
    except ValueError:
        _invalid(f"{field} has invalid value: {s!r}")


def _list(value: Any, field: str) -> list[Any]:
    if value is None:
        return []
    if not isinstance(value, list):
        _invalid(f"{field} must be a list")
    return value


def _date(value: Any, field: str) -> date:
    if not isinstance(value, str):
        _invalid(f"{field} must be an ISO date string")
    try:
        return date.fromisoformat(value)
    except ValueError:
        _invalid(f"{field} must be an ISO date string")


def _time(value: Any, field: str) -> time:
    if not isinstance(value, str):
        _invalid(f"{field} must be an ISO time string")
    try:
        return time.fromisoformat(value)
    except ValueError:
        _invalid(f"{field} must be an ISO time string")


def _nullable_time(value: Any, field: str) -> time | None:
    if value is None:
        return None
    return _time(value, field)


def _datetime(value: Any, field: str) -> datetime:
    if not isinstance(value, str):
        _invalid(f"{field} must be an ISO datetime string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        _invalid(f"{field} must be an ISO datetime string")


def _nullable_datetime(value: Any, field: str) -> datetime | None:
    if value is None:
        return None
    return _datetime(value, field)


def _invalid(detail: str) -> NoReturn:
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)
