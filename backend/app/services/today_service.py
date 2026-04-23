from datetime import date

from app.repositories.today_repository import TodayRepository
from app.schemas.integrations import TodaySummary
from app.schemas.today import DueTodayItem, RoutineTodayItem, TodayResponse


class TodayService:
    """Read model service for today's dashboard and integrations."""

    def __init__(self, repository: TodayRepository | None = None):
        self.repository = repository

    def get_summary(self) -> TodaySummary:
        # Placeholder values until persistence and generation jobs are implemented.
        return TodaySummary(
            overdue_count=0,
            tasks_remaining=0,
            next_medication=None,
        )

    def get_today(self, for_date: date) -> TodayResponse:
        if self.repository is None:
            raise ValueError("TodayRepository is required to fetch today view data")

        routine_tasks = self.repository.get_today_routines(for_date)

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

        due_today = [
            DueTodayItem(
                task_instance_id=task.id,
                title=task.title,
                status=task.status,
                scheduled_date=task.scheduled_date,
                due_at=task.due_at,
            )
            for task in routine_tasks
        ]

        return TodayResponse(
            medication=self.repository.get_medication_placeholder(),
            routines=routines,
            overdue=self.repository.get_overdue_chores_placeholder(),
            due_today=due_today,
            upcoming=[],
            planned=[],
        )
