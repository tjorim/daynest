from datetime import date

from fastapi import HTTPException, status

from app.models.chore_instance import ChoreStatus
from app.models.medication_dose_instance import MedicationDoseStatus
from app.repositories.today_repository import TodayRepository
from app.schemas.integrations import TodaySummary
from app.schemas.today import (
    ChoreInstanceMutationResponse,
    DueTodayItem,
    MedicationHistoryItem,
    MedicationTodayItem,
    OverdueTodayItem,
    RoutineTodayItem,
    TodayResponse,
    UpcomingTodayItem,
)


class TodayService:
    """Read/write service for today's dashboard."""

    UPCOMING_HORIZON_DAYS = 7

    def __init__(self, repository: TodayRepository | None = None):
        self.repository = repository

    def get_summary(self) -> TodaySummary:
        return TodaySummary(
            overdue_count=0,
            tasks_remaining=0,
            next_medication=None,
        )

    def get_today(self, user_id: int, for_date: date) -> TodayResponse:
        if self.repository is None:
            raise ValueError("TodayRepository is required to fetch today view data")

        self.repository.ensure_chore_instances_generated(
            user_id=user_id,
            through_date=date.fromordinal(for_date.toordinal() + self.UPCOMING_HORIZON_DAYS),
        )
        self.repository.ensure_medication_dose_instances_generated(
            user_id=user_id,
            through_date=for_date,
        )
        self.repository.mark_due_medications_missed(user_id=user_id, now=self.repository.utcnow())

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
            planned=[],
        )

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
        )

    def reschedule_chore(self, user_id: int, chore_instance_id: int, scheduled_date: date) -> ChoreInstanceMutationResponse:
        instance = self._get_user_chore(user_id, chore_instance_id)
        instance.scheduled_date = scheduled_date
        instance.status = ChoreStatus.pending
        instance.completed_at = None
        instance.skipped_at = None
        self.repository.save()
        return ChoreInstanceMutationResponse(
            chore_instance_id=instance.id,
            status=instance.status,
            scheduled_date=instance.scheduled_date,
        )

    def _get_user_chore(self, user_id: int, chore_instance_id: int):
        instance = self.repository.get_chore_instance_for_user(user_id=user_id, chore_instance_id=chore_instance_id)
        if instance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore instance not found")
        return instance

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
            raise ValueError("Unsupported medication action")

        self.repository.save()
        return instance
