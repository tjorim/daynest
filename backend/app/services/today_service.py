from calendar import monthrange
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import cast

from fastapi import HTTPException, status

from app.models.chore_instance import ChoreInstance, ChoreStatus
from app.models.medication_dose_instance import MedicationDoseInstance, MedicationDoseStatus
from app.models.planned_item import PlannedItem
from app.models.task_instance import TaskInstance, TaskStatus
from app.repositories.today_repository import TodayRepository
from app.schemas.integrations import DashboardReadModel, TodaySummary
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
    TodayResponse,
    UnifiedDayItem,
    UpcomingTodayItem,
)


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

    UPCOMING_HORIZON_DAYS = 7
    MEDICATION_MISSED_GRACE_MINUTES = 30

    def __init__(self, repository: TodayRepository):
        self.repository = repository

    def _fetch_day_data(self, user_id: int, for_date: date) -> _TodayData:
        self.repository.ensure_chore_instances_generated(
            user_id=user_id,
            through_date=for_date + timedelta(days=self.UPCOMING_HORIZON_DAYS),
        )
        self.repository.ensure_medication_dose_instances_generated(user_id=user_id, through_date=for_date)
        self.repository.mark_due_medications_missed(
            user_id=user_id,
            now=self.repository.utcnow(),
            grace_minutes=self.MEDICATION_MISSED_GRACE_MINUTES,
        )
        return _TodayData(
            overdue=self.repository.get_overdue_chores(user_id=user_id, for_date=for_date),
            due_today=self.repository.get_due_today_chores(user_id=user_id, for_date=for_date),
            all_chores=self.repository.get_day_chores(user_id=user_id, target_date=for_date),
            routines=self.repository.get_today_routines(user_id=user_id, for_date=for_date),
            planned=self.repository.list_planned_items(user_id=user_id, start_date=for_date, end_date=for_date),
            medication=self.repository.get_today_medication(user_id=user_id, for_date=for_date),
        )

    @staticmethod
    def _format_next_medication(medication: list[MedicationDoseInstance]) -> str | None:
        next_med = next((item for item in medication if item.status == MedicationDoseStatus.scheduled), None)
        return f"{next_med.name} @ {next_med.scheduled_at.strftime('%H:%M')}" if next_med else None

    def get_summary(self, user_id: int, for_date: date) -> TodaySummary:
        data = self._fetch_day_data(user_id=user_id, for_date=for_date)
        return TodaySummary(
            overdue_count=len(data.overdue),
            tasks_remaining=len(data.due_today) + len([r for r in data.routines if r.status in (TaskStatus.pending, TaskStatus.in_progress)]) + len([item for item in data.planned if not item.is_done]),
            next_medication=self._format_next_medication(data.medication),
        )

    def get_dashboard_read_model(self, user_id: int, for_date: date) -> DashboardReadModel:
        data = self._fetch_day_data(user_id=user_id, for_date=for_date)
        completed_count = (
            len([item for item in data.all_chores if item.status == ChoreStatus.completed])
            + len([item for item in data.planned if item.is_done])
            + len([item for item in data.medication if item.status == MedicationDoseStatus.taken])
            + len([item for item in data.routines if item.status == TaskStatus.completed])
        )
        total = len(data.all_chores) + len(data.planned) + len(data.medication) + len(data.routines)
        return DashboardReadModel(
            for_date=for_date,
            overdue_count=len(data.overdue),
            due_today_count=len(data.due_today),
            planned_count=len(data.planned),
            medication_due_count=len([item for item in data.medication if item.status == MedicationDoseStatus.scheduled]),
            completion_ratio=round(completed_count / total if total else 0.0, 3),
            next_medication=self._format_next_medication(data.medication),
        )

    def get_today(self, user_id: int, for_date: date) -> TodayResponse:
        self.repository.ensure_chore_instances_generated(
            user_id=user_id,
            through_date=for_date + timedelta(days=self.UPCOMING_HORIZON_DAYS),
        )
        self.repository.ensure_medication_dose_instances_generated(
            user_id=user_id,
            through_date=for_date,
        )
        self.repository.mark_due_medications_missed(
            user_id=user_id,
            now=self.repository.utcnow(),
            grace_minutes=self.MEDICATION_MISSED_GRACE_MINUTES,
        )

        today_medication = self.repository.get_today_medication(user_id=user_id, for_date=for_date)
        medication_history = self.repository.get_medication_history(user_id=user_id, before_date=for_date)
        routine_tasks = self.repository.get_today_routines(user_id=user_id, for_date=for_date)
        overdue_chores = self.repository.get_overdue_chores(user_id=user_id, for_date=for_date)
        due_today_chores = self.repository.get_due_today_chores(user_id=user_id, for_date=for_date)
        upcoming_chores = self.repository.get_upcoming_chores(
            user_id=user_id,
            for_date=for_date,
            horizon_days=self.UPCOMING_HORIZON_DAYS,
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
                )
                for item in due_today_chores
            ],
            upcoming=[
                UpcomingTodayItem(
                    chore_instance_id=item.id,
                    chore_template_id=item.chore_template_id,
                    title=item.title,
                    scheduled_date=item.scheduled_date,
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
        self.repository.ensure_chore_instances_generated(user_id=user_id, through_date=for_date)
        self.repository.ensure_medication_dose_instances_generated(user_id=user_id, through_date=for_date)
        self.repository.mark_due_medications_missed(
            user_id=user_id,
            now=self.repository.utcnow(),
            grace_minutes=self.MEDICATION_MISSED_GRACE_MINUTES,
        )

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
                )
            )

        items.sort(
            key=lambda value: (
                value.scheduled_at is None,
                value.scheduled_at or datetime.min.replace(tzinfo=timezone.utc),
                value.item_type,
                value.item_id,
            )
        )
        return items

    def get_month(self, user_id: int, year: int, month: int) -> CalendarMonthResponse:
        _, last_day = monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, last_day)

        self.repository.ensure_chore_instances_generated(user_id=user_id, through_date=end_date)
        self.repository.ensure_medication_dose_instances_generated(user_id=user_id, through_date=end_date)
        self.repository.mark_due_medications_missed(
            user_id=user_id,
            now=self.repository.utcnow(),
            grace_minutes=self.MEDICATION_MISSED_GRACE_MINUTES,
        )

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

    def create_planned_item(self, user_id: int, request: PlannedItemCreateRequest) -> PlannedTodayItem:
        item = self.repository.add_planned_item(
            PlannedItem(
                user_id=user_id,
                title=request.title,
                notes=request.notes,
                module_key=request.module_key,
                recurrence_hint=request.recurrence_hint,
                linked_source=request.linked_source,
                linked_ref=request.linked_ref,
                planned_for=request.planned_for,
                is_done=False,
            )
        )
        return self._planned_item_to_schema(item)

    def update_planned_item(self, user_id: int, planned_item_id: int, request: PlannedItemUpdateRequest) -> PlannedTodayItem:
        item = self._get_user_planned_item(user_id=user_id, planned_item_id=planned_item_id)
        item.title = request.title
        item.notes = request.notes
        item.module_key = request.module_key
        item.recurrence_hint = request.recurrence_hint
        item.linked_source = request.linked_source
        item.linked_ref = request.linked_ref
        item.planned_for = request.planned_for
        if request.is_done and not item.is_done:
            item.completed_at = self.repository.utcnow()
        elif not request.is_done:
            item.completed_at = None
        item.is_done = request.is_done
        self.repository.save()
        return self._planned_item_to_schema(item)

    def list_planned_items(self, user_id: int, start_date: date | None = None, end_date: date | None = None) -> list[PlannedTodayItem]:
        return [
            self._planned_item_to_schema(item)
            for item in self.repository.list_planned_items(user_id=user_id, start_date=start_date, end_date=end_date)
        ]

    def delete_planned_item(self, user_id: int, planned_item_id: int) -> None:
        item = self._get_user_planned_item(user_id=user_id, planned_item_id=planned_item_id)
        self.repository.delete_planned_item(item)

    def complete_chore(self, user_id: int, chore_instance_id: int) -> ChoreInstanceMutationResponse:
        instance = self._get_user_chore(user_id, chore_instance_id)
        instance.status = ChoreStatus.completed
        instance.completed_at = self.repository.utcnow()
        instance.skipped_at = None
        self.repository.save()
        return ChoreInstanceMutationResponse(
            chore_instance_id=instance.id,
            status=instance.status,
            scheduled_date=instance.scheduled_date,
            completed_at=instance.completed_at,
            skipped_at=instance.skipped_at,
        )

    def skip_chore(self, user_id: int, chore_instance_id: int) -> ChoreInstanceMutationResponse:
        instance = self._get_user_chore(user_id, chore_instance_id)
        instance.status = ChoreStatus.skipped
        instance.skipped_at = self.repository.utcnow()
        instance.completed_at = None
        self.repository.save()
        return ChoreInstanceMutationResponse(
            chore_instance_id=instance.id,
            status=instance.status,
            scheduled_date=instance.scheduled_date,
            completed_at=instance.completed_at,
            skipped_at=instance.skipped_at,
        )

    def reschedule_chore(self, user_id: int, chore_instance_id: int, scheduled_date: date) -> ChoreInstanceMutationResponse:
        instance = self._get_user_chore(user_id, chore_instance_id)
        if instance.status in (ChoreStatus.completed, ChoreStatus.skipped):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Completed or skipped chores cannot be rescheduled")
        instance.scheduled_date = scheduled_date
        instance.status = ChoreStatus.pending
        instance.completed_at = None
        instance.skipped_at = None
        self.repository.save()
        return ChoreInstanceMutationResponse(
            chore_instance_id=instance.id,
            status=instance.status,
            scheduled_date=instance.scheduled_date,
            completed_at=instance.completed_at,
            skipped_at=instance.skipped_at,
        )

    def _get_user_chore(self, user_id: int, chore_instance_id: int):
        instance = self.repository.get_chore_instance_for_user(user_id=user_id, chore_instance_id=chore_instance_id)
        if instance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore instance not found")
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
            notes=item.notes,
            module_key=cast(PlannedItemModuleKey | None, item.module_key),
            recurrence_hint=item.recurrence_hint,
            linked_source=item.linked_source,
            linked_ref=item.linked_ref,
            is_done=item.is_done,
        )

    def mutate_medication_status(self, user_id: int, medication_dose_instance_id: int, action: str):
        instance = self.repository.get_dose_for_user(user_id=user_id, dose_id=medication_dose_instance_id)
        if instance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication dose instance not found")
        if instance.status != MedicationDoseStatus.scheduled:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Medication dose can only be updated from scheduled")

        now = self.repository.utcnow()
        if action == "take":
            instance.status = MedicationDoseStatus.taken
            instance.taken_at = now
            instance.skipped_at = None
            instance.missed_at = None
        elif action == "skip":
            instance.status = MedicationDoseStatus.skipped
            instance.skipped_at = now
            instance.taken_at = None
            instance.missed_at = None
        elif action == "miss":
            instance.status = MedicationDoseStatus.missed
            instance.missed_at = now
            instance.taken_at = None
            instance.skipped_at = None
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported medication action")

        self.repository.save()
        return instance
