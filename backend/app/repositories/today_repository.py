import logging
from collections.abc import Sequence
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import and_, delete, func, insert, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.enums import ChoreStatus, MedicationDoseStatus, Priority, TaskStatus
from app.models.user import User
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
from app.models.recurrence_series import RecurrenceSeries
from app.models.routine_template import RoutineTemplate
from app.models.task_instance import TaskInstance

logger = logging.getLogger(__name__)

try:
    from dateutil.rrule import rrulestr as _rrulestr
    _DATEUTIL_AVAILABLE = True
except ImportError:
    _DATEUTIL_AVAILABLE = False


class TodayRepository:
    def __init__(self, db: Session):
        self.db = db

    def ensure_chore_instances_generated(self, user_id: int, through_date: date) -> None:
        templates = list(
            self.db.scalars(
                select(ChoreTemplate)
                .where(ChoreTemplate.user_id == user_id)
                .where(ChoreTemplate.is_active.is_(True))
            ).all()
        )
        if not templates:
            return

        template_ids = [t.id for t in templates]
        last_generated_rows = self.db.execute(
            select(ChoreInstance.chore_template_id, func.max(ChoreInstance.scheduled_date))
            .where(ChoreInstance.chore_template_id.in_(template_ids))
            .group_by(ChoreInstance.chore_template_id)
        ).all()
        last_generated_map: dict[int, date] = {row[0]: row[1] for row in last_generated_rows}

        rows = []
        for template in templates:
            if template.start_date > through_date:
                continue

            last = last_generated_map.get(template.id)

            rrule_generated = False
            rrule_failed = False
            if template.rrule and _DATEUTIL_AVAILABLE:
                try:
                    dtstart = datetime.combine(template.start_date, time.min)
                    rule = _rrulestr(template.rrule, dtstart=dtstart, ignoretz=True)
                    start_search = datetime.combine(last, time.max) if last else dtstart - timedelta(seconds=1)
                    occurrences = rule.between(start_search, datetime.combine(through_date, time.max), inc=False)
                except Exception:
                    logger.warning("Failed to parse rrule for chore template %s: %r", template.id, template.rrule, exc_info=True)
                    rrule_failed = True
                else:
                    rrule_generated = True
                    for dt in occurrences:
                        rows.append({
                            "user_id": user_id,
                            "chore_template_id": template.id,
                            "title": template.name,
                            "scheduled_date": dt.date(),
                            "status": ChoreStatus.pending,
                        })

            if not template.rrule or not _DATEUTIL_AVAILABLE or rrule_failed:
                step = max(template.every_n_days, 1)
                cursor = template.start_date if last is None else date.fromordinal(last.toordinal() + step)
                while cursor <= through_date:
                    rows.append({
                        "user_id": user_id,
                        "chore_template_id": template.id,
                        "title": template.name,
                        "scheduled_date": cursor,
                        "status": ChoreStatus.pending,
                    })
                    cursor = date.fromordinal(cursor.toordinal() + step)
            elif rrule_generated:
                continue

        if rows:
            dialect_name = self.db.connection().dialect.name
            if dialect_name == "postgresql":
                self.db.execute(
                    pg_insert(ChoreInstance).values(rows).on_conflict_do_nothing(
                        index_elements=["chore_template_id", "scheduled_date"]
                    )
                )
            else:
                self.db.execute(insert(ChoreInstance).prefix_with("OR IGNORE").values(rows))

        self.db.commit()

    def get_user_timezone(self, user_id: int) -> str:
        user = self.db.scalar(select(User).where(User.id == user_id))
        return user.timezone if user else "UTC"

    def ensure_medication_dose_instances_generated(self, user_id: int, through_date: date, user_timezone: str = "UTC") -> None:
        templates = list(
            self.db.scalars(
                select(MedicationPlan)
                .where(MedicationPlan.user_id == user_id)
                .where(MedicationPlan.is_active.is_(True))
            ).all()
        )
        if not templates:
            return

        template_ids = [t.id for t in templates]
        last_generated_rows = self.db.execute(
            select(MedicationDoseInstance.medication_plan_id, func.max(MedicationDoseInstance.scheduled_date))
            .where(MedicationDoseInstance.medication_plan_id.in_(template_ids))
            .group_by(MedicationDoseInstance.medication_plan_id)
        ).all()
        last_generated_map: dict[int, date] = {row[0]: row[1] for row in last_generated_rows}

        new_instances = []
        for template in templates:
            if template.start_date > through_date:
                continue

            step = max(template.every_n_days, 1)
            last = last_generated_map.get(template.id)
            cursor = template.start_date if last is None else date.fromordinal(last.toordinal() + step)

            tz = ZoneInfo(user_timezone)
            while cursor <= through_date:
                scheduled_at = datetime.combine(cursor, template.schedule_time, tzinfo=tz).astimezone(timezone.utc)
                new_instances.append(
                    MedicationDoseInstance(
                        user_id=user_id,
                        medication_plan_id=template.id,
                        name=template.name,
                        instructions=template.instructions,
                        scheduled_date=cursor,
                        scheduled_at=scheduled_at,
                        status=MedicationDoseStatus.scheduled,
                    )
                )
                cursor = date.fromordinal(cursor.toordinal() + step)

        if new_instances:
            self.db.add_all(new_instances)
        self.db.commit()

    def mark_due_medications_missed(self, user_id: int, now: datetime, grace_minutes: int = 30) -> None:
        cutoff = now - timedelta(minutes=grace_minutes)
        stmt = (
            update(MedicationDoseInstance)
            .where(MedicationDoseInstance.user_id == user_id)
            .where(MedicationDoseInstance.status == MedicationDoseStatus.scheduled)
            .where(MedicationDoseInstance.scheduled_at < cutoff)
            .values(status=MedicationDoseStatus.missed, missed_at=now, taken_at=None, skipped_at=None)
            .execution_options(synchronize_session=False)
        )
        self.db.execute(stmt)
        self.db.commit()

    def get_today_medication(self, user_id: int, for_date: date) -> list[MedicationDoseInstance]:
        stmt = (
            select(MedicationDoseInstance)
            .where(MedicationDoseInstance.user_id == user_id)
            .where(MedicationDoseInstance.scheduled_date == for_date)
            .order_by(MedicationDoseInstance.scheduled_at.asc(), MedicationDoseInstance.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_medication_history(
        self,
        user_id: int,
        before_date: date,
        limit: int = 20,
        medication_plan_id: int | None = None,
    ) -> list[MedicationDoseInstance]:
        stmt = (
            select(MedicationDoseInstance)
            .where(MedicationDoseInstance.user_id == user_id)
            .where(MedicationDoseInstance.scheduled_date < before_date)
        )
        if medication_plan_id is not None:
            stmt = stmt.where(MedicationDoseInstance.medication_plan_id == medication_plan_id)
        stmt = stmt.order_by(MedicationDoseInstance.scheduled_at.desc(), MedicationDoseInstance.id.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def list_medication_plans(self, user_id: int) -> list[MedicationPlan]:
        stmt = select(MedicationPlan).where(MedicationPlan.user_id == user_id).order_by(MedicationPlan.id.asc())
        return list(self.db.scalars(stmt).all())

    def list_routine_templates(self, user_id: int) -> list[RoutineTemplate]:
        stmt = select(RoutineTemplate).where(RoutineTemplate.user_id == user_id).order_by(RoutineTemplate.id.asc())
        return list(self.db.scalars(stmt).all())

    def add_routine_template(self, template: RoutineTemplate) -> RoutineTemplate:
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def ensure_task_instances_generated(self, user_id: int, through_date: date) -> None:
        templates = list(
            self.db.scalars(
                select(RoutineTemplate)
                .where(RoutineTemplate.user_id == user_id)
                .where(RoutineTemplate.is_active.is_(True))
            ).all()
        )
        if not templates:
            return

        template_ids = [t.id for t in templates]
        last_generated_rows = self.db.execute(
            select(TaskInstance.routine_template_id, func.max(TaskInstance.scheduled_date))
            .where(TaskInstance.routine_template_id.in_(template_ids))
            .group_by(TaskInstance.routine_template_id)
        ).all()
        last_generated_map: dict[int, date] = {row[0]: row[1] for row in last_generated_rows}

        rows = []
        for template in templates:
            if template.start_date > through_date:
                continue

            last = last_generated_map.get(template.id)

            rrule_generated = False
            rrule_failed = False
            if template.rrule and _DATEUTIL_AVAILABLE:
                try:
                    dtstart = datetime.combine(template.start_date, time.min)
                    rule = _rrulestr(template.rrule, dtstart=dtstart, ignoretz=True)
                    start_search = datetime.combine(last, time.max) if last else dtstart - timedelta(seconds=1)
                    occurrences = rule.between(start_search, datetime.combine(through_date, time.max), inc=False)
                except Exception:
                    logger.warning("Failed to parse rrule for routine template %s: %r", template.id, template.rrule, exc_info=True)
                    rrule_failed = True
                else:
                    rrule_generated = True
                    for dt in occurrences:
                        cursor = dt.date()
                        due_at = datetime.combine(cursor, template.due_time, tzinfo=timezone.utc) if template.due_time else None
                        rows.append({
                            "user_id": user_id,
                            "routine_template_id": template.id,
                            "title": template.name,
                            "scheduled_date": cursor,
                            "due_at": due_at,
                            "status": TaskStatus.pending,
                        })

            if not template.rrule or not _DATEUTIL_AVAILABLE or rrule_failed:
                step = max(template.every_n_days, 1)
                cursor = template.start_date if last is None else date.fromordinal(last.toordinal() + step)
                while cursor <= through_date:
                    due_at = datetime.combine(cursor, template.due_time, tzinfo=timezone.utc) if template.due_time else None
                    rows.append({
                        "user_id": user_id,
                        "routine_template_id": template.id,
                        "title": template.name,
                        "scheduled_date": cursor,
                        "due_at": due_at,
                        "status": TaskStatus.pending,
                    })
                    cursor = date.fromordinal(cursor.toordinal() + step)
            elif rrule_generated:
                continue

        if rows:
            dialect_name = self.db.connection().dialect.name
            if dialect_name == "postgresql":
                self.db.execute(
                    pg_insert(TaskInstance).values(rows).on_conflict_do_nothing(
                        index_elements=["routine_template_id", "scheduled_date"]
                    )
                )
            else:
                self.db.execute(insert(TaskInstance).prefix_with("OR IGNORE").values(rows))

        self.db.commit()

    def get_routine_template_for_user(self, user_id: int, routine_template_id: int) -> RoutineTemplate | None:
        stmt = select(RoutineTemplate).where(RoutineTemplate.user_id == user_id).where(RoutineTemplate.id == routine_template_id)
        return self.db.scalar(stmt)

    def delete_routine_template(self, template: RoutineTemplate) -> None:
        self.db.delete(template)
        self.db.commit()

    def update_routine_template(
        self,
        template: RoutineTemplate,
        name: str,
        description: str | None,
        start_date: date,
        every_n_days: int,
        rrule: str | None,
        due_time: time | None,
        is_active: bool,
    ) -> RoutineTemplate:
        template.name = name
        template.description = description
        template.start_date = start_date
        template.every_n_days = every_n_days
        template.rrule = rrule
        template.due_time = due_time
        template.is_active = is_active
        self.db.commit()
        self.db.refresh(template)
        return template

    def list_chore_templates(self, user_id: int, tags: list[str] | None = None) -> list[ChoreTemplate]:
        stmt = select(ChoreTemplate).where(ChoreTemplate.user_id == user_id).order_by(ChoreTemplate.id.asc())
        templates = list(self.db.scalars(stmt).all())
        if tags:
            templates = [t for t in templates if any(tag in (t.tags or []) for tag in tags)]
        return templates

    def add_chore_template(self, template: ChoreTemplate) -> ChoreTemplate:
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def get_chore_template_for_user(self, user_id: int, chore_template_id: int) -> ChoreTemplate | None:
        stmt = select(ChoreTemplate).where(ChoreTemplate.user_id == user_id).where(ChoreTemplate.id == chore_template_id)
        return self.db.scalar(stmt)

    def delete_chore_template(self, template: ChoreTemplate) -> None:
        self.db.delete(template)
        self.db.commit()

    def update_chore_template(
        self,
        template: ChoreTemplate,
        name: str,
        description: str | None,
        start_date: date,
        every_n_days: int,
        rrule: str | None,
        priority: Priority,
        tags: list,
        is_active: bool,
    ) -> ChoreTemplate:
        template.name = name
        template.description = description
        template.start_date = start_date
        template.every_n_days = every_n_days
        template.rrule = rrule
        template.priority = priority
        template.tags = tags
        template.is_active = is_active
        self.db.commit()
        self.db.refresh(template)
        return template

    def add_medication_plan(self, plan: MedicationPlan) -> MedicationPlan:
        self.db.add(plan)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def get_medication_plan_for_user(self, user_id: int, medication_plan_id: int) -> MedicationPlan | None:
        stmt = (
            select(MedicationPlan)
            .where(MedicationPlan.user_id == user_id)
            .where(MedicationPlan.id == medication_plan_id)
        )
        return self.db.scalar(stmt)

    def update_medication_plan(
        self,
        plan: MedicationPlan,
        name: str,
        instructions: str,
        start_date: date,
        schedule_time: time,
        every_n_days: int,
        is_active: bool,
    ) -> MedicationPlan:
        plan.name = name
        plan.instructions = instructions
        plan.start_date = start_date
        plan.schedule_time = schedule_time
        plan.every_n_days = every_n_days
        plan.is_active = is_active
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def delete_medication_plan(self, plan: MedicationPlan) -> None:
        self.db.delete(plan)
        self.db.commit()

    def get_dose_for_user(self, user_id: int, dose_id: int) -> MedicationDoseInstance | None:
        stmt = select(MedicationDoseInstance).where(MedicationDoseInstance.user_id == user_id).where(MedicationDoseInstance.id == dose_id)
        return self.db.scalar(stmt)

    def get_task_instance_for_user(self, user_id: int, task_instance_id: int) -> TaskInstance | None:
        stmt = select(TaskInstance).where(TaskInstance.user_id == user_id).where(TaskInstance.id == task_instance_id)
        return self.db.scalar(stmt)

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

    def list_planned_items(self, user_id: int, start_date: date | None = None, end_date: date | None = None, is_done: bool | None = None, tags: list[str] | None = None) -> list[PlannedItem]:
        stmt = select(PlannedItem).where(PlannedItem.user_id == user_id)
        if start_date is not None:
            stmt = stmt.where(PlannedItem.planned_for >= start_date)
        if end_date is not None:
            stmt = stmt.where(PlannedItem.planned_for <= end_date)
        if is_done is not None:
            stmt = stmt.where(PlannedItem.is_done.is_(is_done))
        stmt = stmt.order_by(PlannedItem.planned_for.asc(), PlannedItem.id.asc())
        items = list(self.db.scalars(stmt).all())
        if tags:
            items = [item for item in items if any(tag in (item.tags or []) for tag in tags)]
        return items

    def list_recurrence_series_overlapping(
        self,
        *,
        user_id: int,
        through_date: date,
    ) -> list[RecurrenceSeries]:
        stmt = (
            select(RecurrenceSeries)
            .where(RecurrenceSeries.user_id == user_id)
            .where(RecurrenceSeries.start_date <= through_date)
            .where(
                or_(
                    RecurrenceSeries.materialized_through.is_(None),
                    RecurrenceSeries.materialized_through < through_date,
                )
            )
            .order_by(RecurrenceSeries.start_date.asc(), RecurrenceSeries.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def add_recurrence_series(self, series: RecurrenceSeries) -> RecurrenceSeries:
        self.db.add(series)
        self.db.commit()
        self.db.refresh(series)
        return series

    def materialize_planned_items_for_series(
        self,
        *,
        series: RecurrenceSeries,
        through_date: date,
        materialized_dates: Sequence[date],
    ) -> None:
        rows = [
            {
                "user_id": series.user_id,
                "title": series.title,
                "notes": series.notes,
                "module_key": series.module_key,
                "recurrence_hint": series.recurrence_hint,
                "rrule": series.rrule,
                "recurrence_series_id": series.id,
                "linked_source": series.linked_source,
                "linked_ref": series.linked_ref,
                "planned_for": planned_for,
                "time_of_day": series.time_of_day,
                "duration_minutes": series.duration_minutes,
                "priority": series.priority,
                "tags": series.tags or [],
                "is_done": False,
            }
            for planned_for in materialized_dates
        ]

        dialect_name = self.db.connection().dialect.name
        if rows:
            if dialect_name == "postgresql":
                self.db.execute(
                    pg_insert(PlannedItem).values(rows).on_conflict_do_nothing(
                        index_elements=["recurrence_series_id", "planned_for"]
                    )
                )
            else:
                self.db.execute(insert(PlannedItem).prefix_with("OR IGNORE").values(rows))

        self.db.execute(
            update(RecurrenceSeries)
            .where(RecurrenceSeries.id == series.id)
            .values(materialized_through=through_date)
        )
        self.db.commit()

    def add_planned_item(self, item: PlannedItem) -> PlannedItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def add_planned_items(self, items: Sequence[PlannedItem]) -> list[PlannedItem]:
        self.db.add_all(items)
        self.db.commit()
        for item in items:
            self.db.refresh(item)
        return list(items)

    def get_planned_item_for_user(self, user_id: int, planned_item_id: int) -> PlannedItem | None:
        stmt = select(PlannedItem).where(PlannedItem.user_id == user_id).where(PlannedItem.id == planned_item_id)
        return self.db.scalar(stmt)

    def delete_planned_item(self, item: PlannedItem) -> None:
        self.db.delete(item)
        self.db.commit()

    def delete_planned_item_series(self, *, user_id: int, recurrence_series_id: UUID) -> int:
        delete_count = self.db.scalar(
            select(func.count())
            .select_from(PlannedItem)
            .where(PlannedItem.user_id == user_id)
            .where(PlannedItem.recurrence_series_id == recurrence_series_id)
        ) or 0
        self.db.execute(
            delete(RecurrenceSeries).where(
                RecurrenceSeries.user_id == user_id,
                RecurrenceSeries.id == recurrence_series_id,
            )
        )
        self.db.commit()
        return int(delete_count)

    def delete_planned_item_scope_future(
        self,
        *,
        user_id: int,
        item_id: int,
        recurrence_series_id: UUID,
        start_date: date,
    ) -> None:
        self.db.execute(
            delete(PlannedItem).where(
                PlannedItem.user_id == user_id,
                PlannedItem.recurrence_series_id == recurrence_series_id,
                or_(PlannedItem.id == item_id, PlannedItem.planned_for >= start_date),
            )
        )
        self.db.execute(
            update(RecurrenceSeries)
            .where(RecurrenceSeries.user_id == user_id)
            .where(RecurrenceSeries.id == recurrence_series_id)
            .values(materialized_through=date(9999, 12, 31))
        )
        self.db.commit()

    def get_day_chores(self, user_id: int, target_date: date) -> list[ChoreInstance]:
        stmt = (
            select(ChoreInstance)
            .where(ChoreInstance.user_id == user_id)
            .where(ChoreInstance.scheduled_date == target_date)
            .join(ChoreTemplate, ChoreInstance.chore_template_id == ChoreTemplate.id)
            .where(ChoreTemplate.is_active.is_(True))
            .order_by(ChoreInstance.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_month_chores(self, user_id: int, start_date: date, end_date: date) -> list[ChoreInstance]:
        stmt = (
            select(ChoreInstance)
            .where(ChoreInstance.user_id == user_id)
            .where(ChoreInstance.scheduled_date >= start_date)
            .where(ChoreInstance.scheduled_date <= end_date)
            .join(ChoreTemplate, ChoreInstance.chore_template_id == ChoreTemplate.id)
            .where(ChoreTemplate.is_active.is_(True))
        )
        return list(self.db.scalars(stmt).all())

    def get_month_routines(self, user_id: int, start_date: date, end_date: date) -> list[TaskInstance]:
        stmt = (
            select(TaskInstance)
            .where(TaskInstance.user_id == user_id)
            .where(TaskInstance.scheduled_date >= start_date)
            .where(TaskInstance.scheduled_date <= end_date)
            .join(RoutineTemplate, TaskInstance.routine_template_id == RoutineTemplate.id)
            .where(RoutineTemplate.is_active.is_(True))
        )
        return list(self.db.scalars(stmt).all())

    def get_month_medications(self, user_id: int, start_date: date, end_date: date) -> list[MedicationDoseInstance]:
        stmt = (
            select(MedicationDoseInstance)
            .where(MedicationDoseInstance.user_id == user_id)
            .where(MedicationDoseInstance.scheduled_date >= start_date)
            .where(MedicationDoseInstance.scheduled_date <= end_date)
            .join(MedicationPlan, MedicationDoseInstance.medication_plan_id == MedicationPlan.id)
            .where(MedicationPlan.is_active.is_(True))
        )
        return list(self.db.scalars(stmt).all())

    def get_missed_doses_before(self, user_id: int, before_date: date) -> list[MedicationDoseInstance]:
        """Return all missed doses with scheduled_date strictly before before_date."""
        stmt = (
            select(MedicationDoseInstance)
            .where(MedicationDoseInstance.user_id == user_id)
            .where(MedicationDoseInstance.status == MedicationDoseStatus.missed)
            .where(MedicationDoseInstance.scheduled_date < before_date)
            .order_by(MedicationDoseInstance.scheduled_date.asc(), MedicationDoseInstance.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def save(self) -> None:
        self.db.commit()

    def utcnow(self) -> datetime:
        return datetime.now(timezone.utc)
