import logging
from calendar import monthrange
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status

from app.core.config import AppSettings
from app.core.enums import ChoreStatus, MedicationDoseStatus, Priority, TaskStatus
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
from app.models.recurrence_series import RecurrenceSeries
from app.models.routine_template import RoutineTemplate
from app.models.task_instance import TaskInstance
from app.repositories.today_repository import TodayRepository
from app.schemas.integrations import DashboardReadModel, HACalendarEvent
from app.schemas.today import (
    CalendarDayResponse,
    CalendarMonthDaySummary,
    CalendarMonthResponse,
    ChoreInstanceMutationResponse,
    DueTodayItem,
    MedicationHistoryItem,
    MedicationTodayItem,
    OverdueTodayItem,
    PlannedItemCreateRequest,
    PlannedItemModuleKey,
    PlannedItemUpdateRequest,
    PlannedTodayItem,
    RoutineTodayItem,
    TaskInstanceMutationResponse,
    TodayResponse,
    UnifiedDayItem,
    UpcomingTodayItem,
)
from app.services.recurrence_service import (
    RecurrenceValidationError,
    generate_recurrence,
    generate_recurrence_dates,
    truncate_rrule_until,
)

_PRIORITY_RANK: dict[str, int] = {
    Priority.urgent: 0,
    Priority.high: 1,
    Priority.normal: 2,
    Priority.low: 3,
}

logger = logging.getLogger(__name__)

MAX_CALENDAR_RANGE_DAYS = 366
RECURRENCE_EXHAUSTED_SENTINEL = date(9999, 12, 31)
DEFAULT_PLANNED_ITEMS_LOOKAHEAD_DAYS = 90


@dataclass
class _TodayData:
    overdue: list[ChoreInstance]
    due_today: list[ChoreInstance]
    all_chores: list[ChoreInstance]
    routines: list[TaskInstance]
    planned: list[PlannedItem]
    medication: list[MedicationDoseInstance]


class TodayService:
    """Read/write service for today's dashboard."""

    def __init__(self, repository: TodayRepository, app_settings: AppSettings):
        self.repository = repository
        self._upcoming_horizon_days = app_settings.upcoming_horizon_days
        self._medication_missed_grace_minutes = app_settings.medication_missed_grace_minutes

    def _fetch_day_data(self, user_id: int, for_date: date) -> _TodayData:
        user_tz_str = self.repository.get_user_timezone(user_id)
        self.repository.ensure_chore_instances_generated(
            user_id=user_id,
            through_date=for_date + timedelta(days=self._upcoming_horizon_days),
        )
        self.repository.ensure_task_instances_generated(user_id=user_id, through_date=for_date)
        self.repository.ensure_medication_dose_instances_generated(user_id=user_id, through_date=for_date, user_timezone=user_tz_str)
        self.repository.mark_due_medications_missed(
            user_id=user_id,
            now=self.repository.utcnow(),
            grace_minutes=self._medication_missed_grace_minutes,
        )
        self._materialize_planned_items_through(user_id=user_id, through_date=for_date)
        return _TodayData(
            overdue=self.repository.get_overdue_chores(user_id=user_id, for_date=for_date),
            due_today=self.repository.get_due_today_chores(user_id=user_id, for_date=for_date),
            all_chores=self.repository.get_day_chores(user_id=user_id, target_date=for_date),
            routines=self.repository.get_today_routines(user_id=user_id, for_date=for_date),
            planned=self.repository.list_planned_items(user_id=user_id, start_date=for_date, end_date=for_date),
            medication=self.repository.get_today_medication(user_id=user_id, for_date=for_date),
        )

    def _materialize_planned_items_through(self, *, user_id: int, through_date: date) -> None:
        for series in self.repository.list_recurrence_series_overlapping(user_id=user_id, through_date=through_date):
            self._materialize_series(series=series, through_date=through_date)

    @staticmethod
    def _validate_rrule_start_or_422(*, start_date: date, rrule: str) -> None:
        try:
            first_dates = generate_recurrence_dates(start_date, rrule, max_instances=1)
        except RecurrenceValidationError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid rrule") from exc
        if not first_dates or first_dates[0] != start_date:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid rrule")

    def _materialize_series(self, *, series: RecurrenceSeries, through_date: date) -> None:
        if series.materialized_through is not None and series.materialized_through >= through_date:
            return
        from_date = series.start_date if series.materialized_through is None else (series.materialized_through + timedelta(days=1))
        if from_date > through_date:
            return
        generation = generate_recurrence(from_date, series.rrule, dtstart=series.start_date, through_date=through_date)
        if not generation.has_occurrence_after_horizon:
            effective_through_date = RECURRENCE_EXHAUSTED_SENTINEL
        else:
            effective_through_date = through_date
        self.repository.materialize_planned_items_for_series(
            series=series,
            through_date=effective_through_date,
            materialized_dates=generation.dates,
        )

    @staticmethod
    def _format_next_medication(medication: list[MedicationDoseInstance], user_tz: ZoneInfo) -> str | None:
        next_med = next((item for item in medication if item.status == MedicationDoseStatus.scheduled), None)
        if next_med is None:
            return None
        local_time = next_med.scheduled_at.astimezone(user_tz)
        return f"{next_med.name} @ {local_time.strftime('%H:%M')}"

    def get_dashboard_read_model(self, user_id: int, for_date: date) -> DashboardReadModel:
        user_tz = ZoneInfo(self.repository.get_user_timezone(user_id))
        data = self._fetch_day_data(user_id=user_id, for_date=for_date)
        completed_count = (
            len([item for item in data.all_chores if item.status == ChoreStatus.completed])
            + len([item for item in data.planned if item.is_done])
            + len([item for item in data.medication if item.status == MedicationDoseStatus.taken])
            + len([item for item in data.routines if item.status == TaskStatus.completed])
        )
        total = len(data.all_chores) + len(data.planned) + len(data.medication) + len(data.routines)

        overdue_undone_planned = self.repository.list_planned_items(
            user_id=user_id,
            end_date=for_date - timedelta(days=1),
            is_done=False,
        )
        todo_planned = [self._planned_item_to_schema(item) for item in overdue_undone_planned + data.planned]

        chores = [
            DueTodayItem(
                chore_instance_id=item.id,
                chore_template_id=item.chore_template_id,
                title=item.title,
                status=item.status,
                scheduled_date=item.scheduled_date,
                household_id=getattr(getattr(item, "chore_template", None), "household_id", None),
                assigned_to=getattr(item, "assigned_to", None),
                completed_by=getattr(item, "completed_by", None),
            )
            for item in data.overdue + data.all_chores
        ]
        medications = [
            MedicationTodayItem(
                medication_dose_instance_id=item.id,
                medication_plan_id=item.medication_plan_id,
                name=item.name,
                instructions=item.instructions,
                scheduled_at=item.scheduled_at,
                status=item.status,
            )
            for item in data.medication
        ]

        return DashboardReadModel(
            for_date=for_date,
            overdue_count=len(data.overdue),
            due_today_count=len(data.due_today),
            planned_count=len(data.planned),
            planned_remaining_count=len([item for item in data.planned if not item.is_done]),
            medication_due_count=len([item for item in data.medication if item.status == MedicationDoseStatus.scheduled]),
            completion_ratio=round(completed_count / total if total else 0.0, 3),
            next_medication=self._format_next_medication(data.medication, user_tz),
            routines_open_count=len([item for item in data.routines if item.status in (TaskStatus.pending, TaskStatus.in_progress)]),
            due_today=chores,
            planned=todo_planned,
            chores=chores,
            medications=medications,
            planned_items=todo_planned,
        )

    def get_today(self, user_id: int, for_date: date) -> TodayResponse:
        user_tz_str = self.repository.get_user_timezone(user_id)
        self.repository.ensure_chore_instances_generated(
            user_id=user_id,
            through_date=for_date + timedelta(days=self._upcoming_horizon_days),
        )
        self.repository.ensure_task_instances_generated(user_id=user_id, through_date=for_date)
        self.repository.ensure_medication_dose_instances_generated(
            user_id=user_id,
            through_date=for_date,
            user_timezone=user_tz_str,
        )
        self.repository.mark_due_medications_missed(
            user_id=user_id,
            now=self.repository.utcnow(),
            grace_minutes=self._medication_missed_grace_minutes,
        )
        self._materialize_planned_items_through(user_id=user_id, through_date=for_date)

        today_medication = self.repository.get_today_medication(user_id=user_id, for_date=for_date)
        medication_history = self.repository.get_medication_history(user_id=user_id, before_date=for_date)
        routine_tasks = self.repository.get_today_routines(user_id=user_id, for_date=for_date)
        overdue_chores = self.repository.get_overdue_chores(user_id=user_id, for_date=for_date)
        due_today_chores = self.repository.get_due_today_chores(user_id=user_id, for_date=for_date)
        upcoming_chores = self.repository.get_upcoming_chores(
            user_id=user_id,
            for_date=for_date,
            horizon_days=self._upcoming_horizon_days,
        )
        planned = self.repository.list_planned_items(user_id=user_id, start_date=for_date, end_date=for_date)

        routines = [
            RoutineTodayItem(
                task_instance_id=task.id,
                routine_template_id=task.routine_template_id,
                title=task.title,
                status=task.status,
                scheduled_date=task.scheduled_date,
                due_at=task.due_at,
            )
            for task in routine_tasks
        ]

        return TodayResponse(
            medication=[
                MedicationTodayItem(
                    medication_dose_instance_id=item.id,
                    medication_plan_id=item.medication_plan_id,
                    name=item.name,
                    instructions=item.instructions,
                    scheduled_at=item.scheduled_at,
                    status=item.status,
                )
                for item in today_medication
            ],
            medication_history=[
                MedicationHistoryItem(
                    medication_dose_instance_id=item.id,
                    medication_plan_id=item.medication_plan_id,
                    name=item.name,
                    instructions=item.instructions,
                    scheduled_at=item.scheduled_at,
                    status=item.status,
                )
                for item in medication_history
            ],
            routines=routines,
            overdue=[
                OverdueTodayItem(
                    chore_instance_id=item.id,
                    chore_template_id=item.chore_template_id,
                    title=item.title,
                    status=item.status,
                    overdue_since=item.scheduled_date,
                    household_id=getattr(getattr(item, "chore_template", None), "household_id", None),
                    assigned_to=getattr(item, "assigned_to", None),
                    completed_by=getattr(item, "completed_by", None),
                )
                for item in overdue_chores
            ],
            due_today=[
                DueTodayItem(
                    chore_instance_id=item.id,
                    chore_template_id=item.chore_template_id,
                    title=item.title,
                    status=item.status,
                    scheduled_date=item.scheduled_date,
                    household_id=getattr(getattr(item, "chore_template", None), "household_id", None),
                    assigned_to=getattr(item, "assigned_to", None),
                    completed_by=getattr(item, "completed_by", None),
                )
                for item in due_today_chores
            ],
            upcoming=[
                UpcomingTodayItem(
                    chore_instance_id=item.id,
                    chore_template_id=item.chore_template_id,
                    title=item.title,
                    scheduled_date=item.scheduled_date,
                    household_id=getattr(getattr(item, "chore_template", None), "household_id", None),
                    assigned_to=getattr(item, "assigned_to", None),
                )
                for item in upcoming_chores
            ],
            planned=[
                PlannedTodayItem(
                    id=item.id,
                    title=item.title,
                    planned_for=item.planned_for,
                    notes=item.notes,
                    module_key=cast(PlannedItemModuleKey | None, item.module_key),
                    recurrence_hint=item.recurrence_hint,
                    linked_source=item.linked_source,
                    linked_ref=item.linked_ref,
                    priority=item.priority,
                    tags=item.tags or [],
                    is_done=item.is_done,
                )
                for item in planned
            ],
            day_items=self._build_day_items(
                routines=routine_tasks,
                chores=due_today_chores,
                medications=today_medication,
                planned=planned,
            ),
        )

    def get_day_items(self, user_id: int, for_date: date) -> CalendarDayResponse:
        user_tz_str = self.repository.get_user_timezone(user_id)
        self.repository.ensure_chore_instances_generated(user_id=user_id, through_date=for_date)
        self.repository.ensure_task_instances_generated(user_id=user_id, through_date=for_date)
        self.repository.ensure_medication_dose_instances_generated(user_id=user_id, through_date=for_date, user_timezone=user_tz_str)
        self.repository.mark_due_medications_missed(
            user_id=user_id,
            now=self.repository.utcnow(),
            grace_minutes=self._medication_missed_grace_minutes,
        )
        self._materialize_planned_items_through(user_id=user_id, through_date=for_date)

        routines = self.repository.get_today_routines(user_id=user_id, for_date=for_date)
        chores = self.repository.get_day_chores(user_id=user_id, target_date=for_date)
        medications = self.repository.get_today_medication(user_id=user_id, for_date=for_date)
        planned = self.repository.list_planned_items(user_id=user_id, start_date=for_date, end_date=for_date)

        return CalendarDayResponse(
            date=for_date,
            items=self._build_day_items(routines=routines, chores=chores, medications=medications, planned=planned),
        )

    @staticmethod
    def _build_day_items(
        *,
        routines: list[TaskInstance],
        chores: list[ChoreInstance],
        medications: list[MedicationDoseInstance],
        planned: list[PlannedItem],
    ) -> list[UnifiedDayItem]:
        items: list[UnifiedDayItem] = []
        for routine in routines:
            items.append(
                UnifiedDayItem(
                    item_type="routine",
                    item_id=routine.id,
                    title=routine.title,
                    status=routine.status.value,
                    scheduled_date=routine.scheduled_date,
                    scheduled_at=routine.due_at,
                )
            )
        for chore in chores:
            items.append(
                UnifiedDayItem(
                    item_type="chore",
                    item_id=chore.id,
                    title=chore.title,
                    status=chore.status.value,
                    scheduled_date=chore.scheduled_date,
                )
            )
        for med in medications:
            items.append(
                UnifiedDayItem(
                    item_type="medication",
                    item_id=med.id,
                    title=med.name,
                    status=med.status.value,
                    scheduled_date=med.scheduled_date,
                    scheduled_at=med.scheduled_at,
                    detail=med.instructions,
                )
            )
        for plan in planned:
            items.append(
                UnifiedDayItem(
                    item_type="planned",
                    item_id=plan.id,
                    title=plan.title,
                    status="done" if plan.is_done else "planned",
                    scheduled_date=plan.planned_for,
                    detail=plan.notes,
                    module_key=cast(PlannedItemModuleKey | None, plan.module_key),
                    rrule=plan.rrule,
                    recurrence_series_id=str(plan.recurrence_series_id) if plan.recurrence_series_id else None,
                    recurrence_hint=plan.recurrence_hint,
                    linked_source=plan.linked_source,
                    linked_ref=plan.linked_ref,
                    priority=plan.priority,
                )
            )

        items.sort(
            key=lambda value: (
                value.scheduled_at is None,
                value.scheduled_at or datetime.min.replace(tzinfo=timezone.utc),
                _PRIORITY_RANK.get(value.priority, 2),
                value.item_type,
                value.item_id,
            )
        )
        return items

    def get_month(self, user_id: int, year: int, month: int) -> CalendarMonthResponse:
        _, last_day = monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, last_day)

        user_tz_str = self.repository.get_user_timezone(user_id)
        self.repository.ensure_chore_instances_generated(user_id=user_id, through_date=end_date)
        self.repository.ensure_task_instances_generated(user_id=user_id, through_date=end_date)
        self.repository.ensure_medication_dose_instances_generated(user_id=user_id, through_date=end_date, user_timezone=user_tz_str)
        self.repository.mark_due_medications_missed(
            user_id=user_id,
            now=self.repository.utcnow(),
            grace_minutes=self._medication_missed_grace_minutes,
        )
        self._materialize_planned_items_through(user_id=user_id, through_date=end_date)

        by_day: dict[date, dict[str, int]] = defaultdict(lambda: {"routine": 0, "chore": 0, "medication": 0, "planned": 0})

        for routine in self.repository.get_month_routines(user_id=user_id, start_date=start_date, end_date=end_date):
            by_day[routine.scheduled_date]["routine"] += 1
        for chore in self.repository.get_month_chores(user_id=user_id, start_date=start_date, end_date=end_date):
            by_day[chore.scheduled_date]["chore"] += 1
        for medication in self.repository.get_month_medications(user_id=user_id, start_date=start_date, end_date=end_date):
            by_day[medication.scheduled_date]["medication"] += 1
        for planned in self.repository.list_planned_items(user_id=user_id, start_date=start_date, end_date=end_date):
            by_day[planned.planned_for]["planned"] += 1

        days = []
        for day, counts in sorted(by_day.items(), key=lambda item: item[0]):
            total = counts["routine"] + counts["chore"] + counts["medication"] + counts["planned"]
            days.append(
                CalendarMonthDaySummary(
                    date=day,
                    total=total,
                    routines=counts["routine"],
                    chores=counts["chore"],
                    medications=counts["medication"],
                    planned=counts["planned"],
                )
            )

        return CalendarMonthResponse(year=year, month=month, days=days)

    def get_calendar_events(
        self,
        user_id: int,
        start_date: date,
        end_date: date,
        event_types: set[str] | None = None,
    ) -> list[HACalendarEvent]:
        if end_date < start_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must not be before start_date")
        if (end_date - start_date).days > MAX_CALENDAR_RANGE_DAYS:
            logger.warning("Calendar range clamped: %s..%s exceeds %d days", start_date, end_date, MAX_CALENDAR_RANGE_DAYS)
            end_date = start_date + timedelta(days=MAX_CALENDAR_RANGE_DAYS)
        user_tz_str = self.repository.get_user_timezone(user_id)
        self.repository.ensure_chore_instances_generated(user_id=user_id, through_date=end_date)
        self.repository.ensure_task_instances_generated(user_id=user_id, through_date=end_date)
        self.repository.ensure_medication_dose_instances_generated(user_id=user_id, through_date=end_date, user_timezone=user_tz_str)
        self._materialize_planned_items_through(user_id=user_id, through_date=end_date)

        events: list[HACalendarEvent] = []

        include_all = event_types is None
        selected_event_types = event_types or set()
        include_chores = include_all or "chores" in selected_event_types
        include_medications = include_all or "medications" in selected_event_types
        include_planned_items = include_all or "planned_items" in selected_event_types

        if include_chores:
            for chore in self.repository.get_month_chores(user_id=user_id, start_date=start_date, end_date=end_date):
                events.append(HACalendarEvent(
                    uid=f"daynest_chore_{chore.id}",
                    summary=chore.title,
                    start={"date": chore.scheduled_date.isoformat()},
                    end={"date": (chore.scheduled_date + timedelta(days=1)).isoformat()},
                ))

            for routine in self.repository.get_month_routines(user_id=user_id, start_date=start_date, end_date=end_date):
                if routine.due_at:
                    events.append(HACalendarEvent(
                        uid=f"daynest_routine_{routine.id}",
                        summary=routine.title,
                        start={"dateTime": routine.due_at.isoformat()},
                        end={"dateTime": (routine.due_at + timedelta(hours=1)).isoformat()},
                    ))
                else:
                    events.append(HACalendarEvent(
                        uid=f"daynest_routine_{routine.id}",
                        summary=routine.title,
                        start={"date": routine.scheduled_date.isoformat()},
                        end={"date": (routine.scheduled_date + timedelta(days=1)).isoformat()},
                    ))

        if include_medications:
            for med in self.repository.get_month_medications(user_id=user_id, start_date=start_date, end_date=end_date):
                events.append(HACalendarEvent(
                    uid=f"daynest_medication_{med.id}",
                    summary=med.name,
                    start={"dateTime": med.scheduled_at.isoformat()},
                    end={"dateTime": (med.scheduled_at + timedelta(minutes=15)).isoformat()},
                    description=med.instructions,
                ))

        if include_planned_items:
            for planned in self.repository.list_planned_items(user_id=user_id, start_date=start_date, end_date=end_date):
                events.append(HACalendarEvent(
                    uid=f"daynest_planned_{planned.id}",
                    summary=planned.title,
                    start={"date": planned.planned_for.isoformat()},
                    end={"date": (planned.planned_for + timedelta(days=1)).isoformat()},
                    description=planned.notes,
                ))

        events.sort(key=lambda e: e.start.get("date") or e.start.get("dateTime", ""))
        return events

    def create_planned_item(self, user_id: int, request: PlannedItemCreateRequest) -> PlannedTodayItem:
        if request.rrule:
            self._validate_rrule_start_or_422(start_date=request.planned_for, rrule=request.rrule)

            _, item = self.repository.add_recurrence_series_with_first_planned_item(
                series=RecurrenceSeries(
                    user_id=user_id,
                    title=request.title,
                    rrule=request.rrule,
                    start_date=request.planned_for,
                    time_of_day=request.time_of_day,
                    duration_minutes=request.duration_minutes,
                    notes=request.notes,
                    module_key=request.module_key,
                    recurrence_hint=request.recurrence_hint,
                    linked_source=request.linked_source,
                    linked_ref=request.linked_ref,
                    priority=request.priority,
                    tags=request.tags,
                    materialized_through=request.planned_for,
                ),
                item=PlannedItem(
                    user_id=user_id,
                    title=request.title,
                    notes=request.notes,
                    module_key=request.module_key,
                    recurrence_hint=request.recurrence_hint,
                    rrule=request.rrule,
                    linked_source=request.linked_source,
                    linked_ref=request.linked_ref,
                    planned_for=request.planned_for,
                    time_of_day=request.time_of_day,
                    duration_minutes=request.duration_minutes,
                    priority=request.priority,
                    tags=request.tags,
                    is_done=False,
                ),
            )
            return self._planned_item_to_schema(item)

        item = self.repository.add_planned_item(
            PlannedItem(
                user_id=user_id,
                title=request.title,
                notes=request.notes,
                module_key=request.module_key,
                recurrence_hint=request.recurrence_hint,
                rrule=request.rrule,
                linked_source=request.linked_source,
                linked_ref=request.linked_ref,
                planned_for=request.planned_for,
                time_of_day=request.time_of_day,
                duration_minutes=request.duration_minutes,
                priority=request.priority,
                tags=request.tags,
                is_done=False,
            )
        )
        return self._planned_item_to_schema(item)

    def _apply_planned_item_patch(self, item: PlannedItem, request: PlannedItemUpdateRequest) -> None:
        item.title = request.title
        item.notes = request.notes
        item.module_key = request.module_key
        item.recurrence_hint = request.recurrence_hint
        item.rrule = request.rrule
        item.linked_source = request.linked_source
        item.linked_ref = request.linked_ref
        item.planned_for = request.planned_for
        item.time_of_day = request.time_of_day
        item.duration_minutes = request.duration_minutes
        item.priority = request.priority
        item.tags = request.tags
        if request.is_done and not item.is_done:
            item.completed_at = self.repository.utcnow()
        elif not request.is_done:
            item.completed_at = None
        item.is_done = request.is_done

    def update_planned_item_scope_future(
        self,
        *,
        user_id: int,
        item_id: int,
        series_id: UUID,
        from_date: date,
        patch: PlannedItemUpdateRequest,
    ) -> None:
        recurrence_series = self.repository.get_recurrence_series_for_user(user_id=user_id, recurrence_series_id=series_id)
        if recurrence_series is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurrence series not found")
        if patch.rrule:
            self._validate_rrule_start_or_422(start_date=patch.planned_for, rrule=patch.rrule)
        recurrence_series.title = patch.title
        recurrence_series.notes = patch.notes
        recurrence_series.module_key = patch.module_key
        recurrence_series.recurrence_hint = patch.recurrence_hint
        recurrence_series.rrule = patch.rrule or recurrence_series.rrule
        recurrence_series.linked_source = patch.linked_source
        recurrence_series.linked_ref = patch.linked_ref
        recurrence_series.start_date = patch.planned_for
        recurrence_series.time_of_day = patch.time_of_day
        recurrence_series.duration_minutes = patch.duration_minutes
        recurrence_series.priority = patch.priority
        recurrence_series.tags = patch.tags
        recurrence_series.materialized_through = from_date - timedelta(days=1)
        self.repository.delete_materialized_planned_items_for_series(
            user_id=user_id,
            recurrence_series_id=series_id,
            from_date=from_date,
            exclude_item_id=item_id,
        )
        item = self._get_user_planned_item(user_id=user_id, planned_item_id=item_id)
        self._apply_planned_item_patch(item, patch)
        self.repository.save()

    def update_planned_item_series(
        self,
        *,
        user_id: int,
        series_id: UUID,
        patch: PlannedItemUpdateRequest,
        original_planned_for: date | None = None,
        item_id: int | None = None,
    ) -> None:
        recurrence_series = self.repository.get_recurrence_series_for_user(user_id=user_id, recurrence_series_id=series_id)
        if recurrence_series is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurrence series not found")
        new_start_date = recurrence_series.start_date
        if original_planned_for is not None:
            new_start_date = recurrence_series.start_date + (patch.planned_for - original_planned_for)
        if patch.rrule:
            self._validate_rrule_start_or_422(start_date=new_start_date, rrule=patch.rrule)
        recurrence_series.title = patch.title
        recurrence_series.notes = patch.notes
        recurrence_series.module_key = patch.module_key
        recurrence_series.recurrence_hint = patch.recurrence_hint
        recurrence_series.rrule = patch.rrule or recurrence_series.rrule
        recurrence_series.linked_source = patch.linked_source
        recurrence_series.linked_ref = patch.linked_ref
        recurrence_series.start_date = new_start_date
        recurrence_series.time_of_day = patch.time_of_day
        recurrence_series.duration_minutes = patch.duration_minutes
        recurrence_series.priority = patch.priority
        recurrence_series.tags = patch.tags
        recurrence_series.materialized_through = new_start_date - timedelta(days=1)
        self.repository.delete_materialized_planned_items_for_series(
            user_id=user_id,
            recurrence_series_id=series_id,
            exclude_item_id=item_id,
        )
        if item_id is not None:
            item = self._get_user_planned_item(user_id=user_id, planned_item_id=item_id)
            self._apply_planned_item_patch(item, patch)
        self.repository.save()

    def update_planned_item(
        self,
        user_id: int,
        planned_item_id: int,
        request: PlannedItemUpdateRequest,
        *,
        scope: Literal["this", "future", "all"] = "this",
    ) -> PlannedTodayItem:
        item = self._get_user_planned_item(user_id=user_id, planned_item_id=planned_item_id)
        if item.recurrence_series_id is not None and scope == "future":
            self.update_planned_item_scope_future(
                user_id=user_id,
                item_id=item.id,
                series_id=item.recurrence_series_id,
                from_date=item.planned_for,
                patch=request,
            )
            return self._planned_item_to_schema(item)
        if item.recurrence_series_id is not None and scope == "all":
            self.update_planned_item_series(
                user_id=user_id,
                series_id=item.recurrence_series_id,
                patch=request,
                original_planned_for=item.planned_for,
                item_id=item.id,
            )
            return self._planned_item_to_schema(item)
        self._apply_planned_item_patch(item, request)
        self.repository.save()
        return self._planned_item_to_schema(item)

    def list_planned_items(self, user_id: int, start_date: date | None = None, end_date: date | None = None, tags: list[str] | None = None) -> list[PlannedTodayItem]:
        materialize_through = end_date or (start_date + timedelta(days=DEFAULT_PLANNED_ITEMS_LOOKAHEAD_DAYS) if start_date else None)
        if materialize_through is not None:
            self._materialize_planned_items_through(user_id=user_id, through_date=materialize_through)
        return [
            self._planned_item_to_schema(item)
            for item in self.repository.list_planned_items(user_id=user_id, start_date=start_date, end_date=end_date, tags=tags)
        ]

    def save(self) -> None:
        self.repository.save()

    def mark_planned_done(self, user_id: int, planned_item_id: int, *, persist: bool = True) -> None:
        item = self._get_user_planned_item(user_id=user_id, planned_item_id=planned_item_id)
        if not item.is_done:
            item.is_done = True
            item.completed_at = self.repository.utcnow()
            if persist:
                self.repository.save()

    def defer_planned_item(self, user_id: int, planned_item_id: int, days: int = 1) -> PlannedTodayItem:
        if days < 1:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="days must be >= 1")
        item = self._get_user_planned_item(user_id=user_id, planned_item_id=planned_item_id)
        return self.update_planned_item(
            user_id=user_id,
            planned_item_id=planned_item_id,
            request=PlannedItemUpdateRequest(
                title=item.title,
                planned_for=self.repository.utcnow().date() + timedelta(days=days),
                is_done=False,
                notes=item.notes,
                module_key=cast(PlannedItemModuleKey | None, item.module_key),
                recurrence_hint=item.recurrence_hint,
                rrule=item.rrule,
                linked_source=item.linked_source,
                linked_ref=item.linked_ref,
                time_of_day=item.time_of_day,
                duration_minutes=item.duration_minutes,
                priority=item.priority,
                tags=item.tags or [],
            ),
        )

    def delete_planned_item_series(self, user_id: int, recurrence_series_id: str) -> int:
        from uuid import UUID as _UUID
        try:
            series_uuid = _UUID(recurrence_series_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid recurrence_series_id format") from exc
        return self.repository.delete_planned_item_series(user_id=user_id, recurrence_series_id=series_uuid)

    def delete_planned_item(self, user_id: int, planned_item_id: int, *, scope: Literal["this", "future"] = "this") -> None:
        item = self._get_user_planned_item(user_id=user_id, planned_item_id=planned_item_id)
        if scope == "future" and item.recurrence_series_id is not None:
            recurrence_series = self.repository.get_recurrence_series_for_user(
                user_id=user_id,
                recurrence_series_id=item.recurrence_series_id,
            )
            if recurrence_series is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurrence series not found")
            cutoff_date = item.planned_for - timedelta(days=1)
            cutoff_dates = generate_recurrence_dates(
                recurrence_series.start_date,
                recurrence_series.rrule,
                dtstart=recurrence_series.start_date,
                through_date=cutoff_date,
            )
            if not cutoff_dates:
                self.repository.delete_planned_item_series(
                    user_id=user_id,
                    recurrence_series_id=item.recurrence_series_id,
                )
                return
            self.repository.delete_planned_item_scope_future(
                user_id=user_id,
                item_id=item.id,
                recurrence_series_id=item.recurrence_series_id,
                start_date=item.planned_for,
                series_rrule=truncate_rrule_until(recurrence_series.rrule, cutoff_dates[-1]),
                materialized_through=cutoff_dates[-1],
            )
            return
        self.repository.delete_planned_item(item)

    def complete_chore(self, user_id: int, chore_instance_id: int, *, persist: bool = True) -> ChoreInstanceMutationResponse:
        instance = self._get_user_chore(user_id, chore_instance_id)
        instance.status = ChoreStatus.completed
        instance.completed_at = self.repository.utcnow()
        instance.completed_by = user_id
        instance.skipped_at = None
        if persist:
            self.repository.save()
        return ChoreInstanceMutationResponse(
            chore_instance_id=instance.id,
            status=instance.status,
            scheduled_date=instance.scheduled_date,
            completed_at=instance.completed_at,
            skipped_at=instance.skipped_at,
            completed_by=instance.completed_by,
        )

    def start_routine_task(self, user_id: int, task_instance_id: int) -> TaskInstanceMutationResponse:
        instance = self._get_user_task(user_id, task_instance_id)
        if instance.status == TaskStatus.completed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Completed tasks cannot be started again")
        if instance.status == TaskStatus.skipped:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Skipped tasks cannot be started again")
        instance.status = TaskStatus.in_progress
        self.repository.save()
        return self._task_instance_to_response(instance)

    def complete_routine_task(self, user_id: int, task_instance_id: int) -> TaskInstanceMutationResponse:
        instance = self._get_user_task(user_id, task_instance_id)
        if instance.status == TaskStatus.completed:
            return self._task_instance_to_response(instance)
        if instance.status == TaskStatus.skipped:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Skipped tasks cannot be completed")
        instance.status = TaskStatus.completed
        instance.completed_at = self.repository.utcnow()
        self.repository.save()
        return self._task_instance_to_response(instance)

    def skip_routine_task(self, user_id: int, task_instance_id: int) -> TaskInstanceMutationResponse:
        instance = self._get_user_task(user_id, task_instance_id)
        if instance.status == TaskStatus.skipped:
            return self._task_instance_to_response(instance)
        if instance.status == TaskStatus.completed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Completed tasks cannot be skipped")
        instance.status = TaskStatus.skipped
        instance.completed_at = None
        self.repository.save()
        return self._task_instance_to_response(instance)

    def skip_chore(self, user_id: int, chore_instance_id: int, *, persist: bool = True) -> ChoreInstanceMutationResponse:
        instance = self._get_user_chore(user_id, chore_instance_id)
        instance.status = ChoreStatus.skipped
        instance.skipped_at = self.repository.utcnow()
        instance.completed_at = None
        instance.completed_by = None
        if persist:
            self.repository.save()
        return ChoreInstanceMutationResponse(
            chore_instance_id=instance.id,
            status=instance.status,
            scheduled_date=instance.scheduled_date,
            completed_at=instance.completed_at,
            skipped_at=instance.skipped_at,
            completed_by=instance.completed_by,
        )

    def reschedule_chore(self, user_id: int, chore_instance_id: int, scheduled_date: date) -> ChoreInstanceMutationResponse:
        instance = self._get_user_chore(user_id, chore_instance_id)
        if instance.status in (ChoreStatus.completed, ChoreStatus.skipped):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Completed or skipped chores cannot be rescheduled")
        instance.scheduled_date = scheduled_date
        instance.status = ChoreStatus.pending
        instance.completed_at = None
        instance.skipped_at = None
        instance.completed_by = None
        self.repository.save()
        return ChoreInstanceMutationResponse(
            chore_instance_id=instance.id,
            status=instance.status,
            scheduled_date=instance.scheduled_date,
            completed_at=instance.completed_at,
            skipped_at=instance.skipped_at,
            completed_by=instance.completed_by,
        )

    def _get_user_chore(self, user_id: int, chore_instance_id: int):
        instance = self.repository.get_chore_instance_for_user(user_id=user_id, chore_instance_id=chore_instance_id)
        if instance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore instance not found")
        return instance

    def assign_chore(self, user_id: int, chore_instance_id: int, assigned_to: int | None) -> ChoreInstanceMutationResponse:
        instance = self._get_user_chore(user_id, chore_instance_id)
        if assigned_to is not None:
            household_id = instance.chore_template.household_id
            if household_id is None:
                if assigned_to != instance.user_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Personal chores can only be assigned to the owner",
                    )
            elif household_id not in self.repository.get_user_household_ids(assigned_to):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assigned user is not a member of this household",
                )
        instance.assigned_to = assigned_to
        self.repository.save()
        return ChoreInstanceMutationResponse(
            chore_instance_id=instance.id,
            status=instance.status,
            scheduled_date=instance.scheduled_date,
            completed_at=instance.completed_at,
            skipped_at=instance.skipped_at,
            completed_by=instance.completed_by,
        )

    def _get_user_task(self, user_id: int, task_instance_id: int) -> TaskInstance:
        instance = self.repository.get_task_instance_for_user(user_id=user_id, task_instance_id=task_instance_id)
        if instance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task instance not found")
        return instance

    def _get_user_planned_item(self, user_id: int, planned_item_id: int) -> PlannedItem:
        item = self.repository.get_planned_item_for_user(user_id=user_id, planned_item_id=planned_item_id)
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planned item not found")
        return item

    @staticmethod
    def _planned_item_to_schema(item: PlannedItem) -> PlannedTodayItem:
        return PlannedTodayItem(
            id=item.id,
            title=item.title,
            planned_for=item.planned_for,
            time_of_day=item.time_of_day,
            duration_minutes=item.duration_minutes,
            notes=item.notes,
            module_key=cast(PlannedItemModuleKey | None, item.module_key),
            recurrence_hint=item.recurrence_hint,
            rrule=item.rrule,
            recurrence_series_id=item.recurrence_series_id,
            linked_source=item.linked_source,
            linked_ref=item.linked_ref,
            priority=item.priority,
            tags=item.tags or [],
            is_done=item.is_done,
        )

    @staticmethod
    def _task_instance_to_response(instance: TaskInstance) -> TaskInstanceMutationResponse:
        return TaskInstanceMutationResponse(
            task_instance_id=instance.id,
            status=instance.status,
            scheduled_date=instance.scheduled_date,
            due_at=instance.due_at,
            completed_at=instance.completed_at,
        )

    def list_routine_templates(self, user_id: int) -> list[RoutineTemplate]:
        return self.repository.list_routine_templates(user_id=user_id)

    def create_routine_template(
        self,
        user_id: int,
        *,
        name: str,
        start_date: date,
        every_n_days: int,
        description: str | None,
        due_time: time | None,
        is_active: bool,
    ) -> RoutineTemplate:
        if every_n_days < 1:
            raise ValueError("every_n_days must be >= 1")
        return self.repository.add_routine_template(
            RoutineTemplate(
                user_id=user_id,
                name=name,
                description=description,
                start_date=start_date,
                every_n_days=every_n_days,
                due_time=due_time,
                is_active=is_active,
            )
        )

    def update_routine_template(
        self,
        user_id: int,
        routine_template_id: int,
        *,
        name: str,
        start_date: date,
        every_n_days: int | None,
        rrule: str | None,
        description: str | None,
        due_time: time | None,
        is_active: bool | None,
    ) -> RoutineTemplate:
        template = self.repository.get_routine_template_for_user(user_id=user_id, routine_template_id=routine_template_id)
        if template is None:
            raise ValueError(f"Routine template {routine_template_id} not found")
        if every_n_days is not None and every_n_days < 1:
            raise ValueError("every_n_days must be >= 1")
        return self.repository.update_routine_template(
            template,
            name=name,
            description=description if description is not None else template.description,
            start_date=start_date,
            every_n_days=every_n_days if every_n_days is not None else template.every_n_days,
            rrule=rrule,
            due_time=due_time if due_time is not None else template.due_time,
            is_active=is_active if is_active is not None else template.is_active,
        )

    def delete_routine_template(self, user_id: int, routine_template_id: int) -> None:
        template = self.repository.get_routine_template_for_user(user_id=user_id, routine_template_id=routine_template_id)
        if template is None:
            raise ValueError(f"Routine template {routine_template_id} not found")
        self.repository.delete_routine_template(template)

    def list_chore_templates(self, user_id: int) -> list[ChoreTemplate]:
        return self.repository.list_chore_templates(user_id=user_id)

    def create_chore_template(
        self,
        user_id: int,
        *,
        name: str,
        start_date: date,
        every_n_days: int,
        description: str | None,
        is_active: bool,
    ) -> ChoreTemplate:
        if every_n_days < 1:
            raise ValueError("every_n_days must be >= 1")
        return self.repository.add_chore_template(
            ChoreTemplate(
                user_id=user_id,
                name=name,
                description=description,
                start_date=start_date,
                every_n_days=every_n_days,
                is_active=is_active,
            )
        )

    def update_chore_template(
        self,
        user_id: int,
        chore_template_id: int,
        *,
        name: str,
        start_date: date,
        every_n_days: int | None,
        rrule: str | None,
        priority: Priority,
        tags: list,
        description: str | None,
        is_active: bool | None,
    ) -> ChoreTemplate:
        template = self.repository.get_chore_template_for_user(user_id=user_id, chore_template_id=chore_template_id)
        if template is None:
            raise ValueError(f"Chore template {chore_template_id} not found")
        if every_n_days is not None and every_n_days < 1:
            raise ValueError("every_n_days must be >= 1")
        return self.repository.update_chore_template(
            template,
            name=name,
            description=description if description is not None else template.description,
            start_date=start_date,
            every_n_days=every_n_days if every_n_days is not None else template.every_n_days,
            rrule=rrule,
            priority=priority,
            tags=tags,
            is_active=is_active if is_active is not None else template.is_active,
        )

    def delete_chore_template(self, user_id: int, chore_template_id: int) -> None:
        template = self.repository.get_chore_template_for_user(user_id=user_id, chore_template_id=chore_template_id)
        if template is None:
            raise ValueError(f"Chore template {chore_template_id} not found")
        self.repository.delete_chore_template(template)

    def list_medication_plans(self, user_id: int) -> list[MedicationPlan]:
        return self.repository.list_medication_plans(user_id=user_id)

    def create_medication_plan(
        self,
        user_id: int,
        *,
        name: str,
        instructions: str,
        start_date: date,
        schedule_time: time,
        every_n_days: int,
    ) -> MedicationPlan:
        if every_n_days < 1:
            raise ValueError("every_n_days must be >= 1")
        return self.repository.add_medication_plan(
            MedicationPlan(
                user_id=user_id,
                name=name,
                instructions=instructions,
                start_date=start_date,
                schedule_time=schedule_time,
                every_n_days=every_n_days,
                is_active=True,
            )
        )

    def update_medication_plan(
        self,
        user_id: int,
        medication_plan_id: int,
        *,
        name: str,
        instructions: str,
        start_date: date,
        schedule_time: time,
        every_n_days: int | None,
        is_active: bool | None,
    ) -> MedicationPlan:
        plan = self.repository.get_medication_plan_for_user(user_id=user_id, medication_plan_id=medication_plan_id)
        if plan is None:
            raise ValueError(f"Medication plan {medication_plan_id} not found")
        if every_n_days is not None and every_n_days < 1:
            raise ValueError("every_n_days must be >= 1")
        return self.repository.update_medication_plan(
            plan,
            name=name,
            instructions=instructions,
            start_date=start_date,
            schedule_time=schedule_time,
            every_n_days=every_n_days if every_n_days is not None else plan.every_n_days,
            is_active=is_active if is_active is not None else plan.is_active,
        )

    def delete_medication_plan(self, user_id: int, medication_plan_id: int) -> None:
        plan = self.repository.get_medication_plan_for_user(user_id=user_id, medication_plan_id=medication_plan_id)
        if plan is None:
            raise ValueError(f"Medication plan {medication_plan_id} not found")
        self.repository.delete_medication_plan(plan)

    def mutate_medication_status(
        self,
        user_id: int,
        medication_dose_instance_id: int,
        action: str,
        taken_at: datetime | None = None,
    ):
        instance = self.repository.get_dose_for_user(user_id=user_id, dose_id=medication_dose_instance_id)
        if instance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication dose instance not found")

        now = self.repository.utcnow()
        if action == "take":
            if instance.status not in {MedicationDoseStatus.scheduled, MedicationDoseStatus.missed}:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Medication dose can only be taken from scheduled or missed")
            if taken_at is not None:
                # Ensure timezone-aware for comparison
                ta = taken_at if taken_at.tzinfo is not None else taken_at.replace(tzinfo=timezone.utc)
                if ta > now:
                    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="taken_at must not be in the future")
                resolved_taken_at = ta
            else:
                resolved_taken_at = now
            instance.status = MedicationDoseStatus.taken
            instance.taken_at = resolved_taken_at
            instance.skipped_at = None
            instance.missed_at = None
        elif action == "skip":
            if instance.status not in {MedicationDoseStatus.scheduled, MedicationDoseStatus.missed}:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Medication dose can only be skipped from scheduled or missed")
            instance.status = MedicationDoseStatus.skipped
            instance.skipped_at = now
            instance.taken_at = None
            instance.missed_at = None
        elif action == "miss":
            if instance.status != MedicationDoseStatus.scheduled:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Medication dose can only be marked missed from scheduled")
            instance.status = MedicationDoseStatus.missed
            instance.missed_at = now
            instance.taken_at = None
            instance.skipped_at = None
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported medication action")

        self.repository.save()
        return instance

    def skip_missed_medication_doses(self, user_id: int, before_date: date | None = None) -> tuple[int, date]:
        """Skip all missed doses with scheduled_date strictly before before_date (defaults to today)."""
        cutoff = before_date if before_date is not None else self.repository.utcnow().date()
        doses = self.repository.get_missed_doses_before(user_id=user_id, before_date=cutoff)
        now = self.repository.utcnow()
        for dose in doses:
            dose.status = MedicationDoseStatus.skipped
            dose.skipped_at = now
            dose.taken_at = None
            dose.missed_at = None
        if doses:
            self.repository.save()
        return len(doses), cutoff
