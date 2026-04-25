from datetime import date, datetime

from pydantic import BaseModel

from app.models.task_instance import TaskStatus


class MedicationTodayItem(BaseModel):
    id: int
    name: str
    due_at: datetime | None = None


class RoutineTodayItem(BaseModel):
    task_instance_id: int
    routine_template_id: int
    title: str
    status: TaskStatus
    scheduled_date: date
    due_at: datetime | None = None


class OverdueTodayItem(BaseModel):
    id: int
    title: str
    overdue_since: date


class DueTodayItem(BaseModel):
    task_instance_id: int
    title: str
    status: TaskStatus
    scheduled_date: date
    due_at: datetime | None = None


class UpcomingTodayItem(BaseModel):
    id: int
    title: str
    scheduled_date: date


class PlannedTodayItem(BaseModel):
    id: int
    title: str
    planned_for: date


class TodayResponse(BaseModel):
    medication: list[MedicationTodayItem]
    routines: list[RoutineTodayItem]
    overdue: list[OverdueTodayItem]
    due_today: list[DueTodayItem]
    upcoming: list[UpcomingTodayItem]
    planned: list[PlannedTodayItem]
