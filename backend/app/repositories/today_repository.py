from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.routine_template import RoutineTemplate
from app.models.task_instance import TaskInstance


class TodayRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_today_routines(self, for_date: date) -> list[TaskInstance]:
        stmt = (
            select(TaskInstance)
            .where(TaskInstance.scheduled_date == for_date)
            .join(RoutineTemplate, TaskInstance.routine_template_id == RoutineTemplate.id)
            .where(RoutineTemplate.is_active.is_(True))
            .order_by(TaskInstance.due_at.asc().nulls_last(), TaskInstance.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_overdue_chores_placeholder(self) -> list[dict[str, str]]:
        return []

    def get_medication_placeholder(self) -> list[dict[str, str]]:
        return []
