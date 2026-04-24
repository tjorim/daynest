from datetime import date, datetime, timezone

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.chore_instance import ChoreInstance, ChoreStatus
from app.models.chore_template import ChoreTemplate
from app.models.routine_template import RoutineTemplate
from app.models.task_instance import TaskInstance


class TodayRepository:
    def __init__(self, db: Session):
        self.db = db

    def ensure_chore_instances_generated(self, user_id: int, through_date: date) -> None:
        templates_stmt = (
            select(ChoreTemplate)
            .where(ChoreTemplate.user_id == user_id)
            .where(ChoreTemplate.is_active.is_(True))
        )
        templates = list(self.db.scalars(templates_stmt).all())

        for template in templates:
            if template.start_date > through_date:
                continue

            existing_dates = set(
                self.db.scalars(
                    select(ChoreInstance.scheduled_date)
                    .where(ChoreInstance.chore_template_id == template.id)
                    .where(ChoreInstance.scheduled_date <= through_date)
                ).all()
            )

            step = max(template.every_n_days, 1)
            cursor = template.start_date
            while cursor <= through_date:
                if cursor not in existing_dates:
                    self.db.add(
                        ChoreInstance(
                            user_id=user_id,
                            chore_template_id=template.id,
                            title=template.name,
                            scheduled_date=cursor,
                            status=ChoreStatus.pending,
                        )
                    )
                cursor = date.fromordinal(cursor.toordinal() + step)

        self.db.commit()

    def get_today_routines(self, user_id: int, for_date: date) -> list[TaskInstance]:
        stmt = (
            select(TaskInstance)
            .where(TaskInstance.scheduled_date == for_date)
            .where(TaskInstance.user_id == user_id)
            .join(RoutineTemplate, TaskInstance.routine_template_id == RoutineTemplate.id)
            .where(RoutineTemplate.is_active.is_(True))
            .order_by(TaskInstance.due_at.asc().nulls_last(), TaskInstance.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_overdue_chores(self, user_id: int, for_date: date) -> list[ChoreInstance]:
        stmt = (
            select(ChoreInstance)
            .where(ChoreInstance.user_id == user_id)
            .where(ChoreInstance.scheduled_date < for_date)
            .where(ChoreInstance.status == ChoreStatus.pending)
            .order_by(ChoreInstance.scheduled_date.asc(), ChoreInstance.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_due_today_chores(self, user_id: int, for_date: date) -> list[ChoreInstance]:
        stmt = (
            select(ChoreInstance)
            .where(ChoreInstance.user_id == user_id)
            .where(ChoreInstance.scheduled_date == for_date)
            .where(ChoreInstance.status == ChoreStatus.pending)
            .order_by(ChoreInstance.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_upcoming_chores(self, user_id: int, for_date: date, horizon_days: int = 7) -> list[ChoreInstance]:
        end_date = date.fromordinal(for_date.toordinal() + horizon_days)
        stmt = (
            select(ChoreInstance)
            .where(ChoreInstance.user_id == user_id)
            .where(and_(ChoreInstance.scheduled_date > for_date, ChoreInstance.scheduled_date <= end_date))
            .where(ChoreInstance.status == ChoreStatus.pending)
            .order_by(ChoreInstance.scheduled_date.asc(), ChoreInstance.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_chore_instance_for_user(self, user_id: int, chore_instance_id: int) -> ChoreInstance | None:
        stmt = select(ChoreInstance).where(ChoreInstance.user_id == user_id).where(ChoreInstance.id == chore_instance_id)
        return self.db.scalar(stmt)

    def save(self) -> None:
        self.db.commit()

    def utcnow(self) -> datetime:
        return datetime.now(timezone.utc)

    def get_medication_placeholder(self) -> list[dict[str, str]]:
        return []
