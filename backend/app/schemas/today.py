from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.chore_instance import ChoreStatus
from app.models.medication_dose_instance import MedicationDoseStatus
from app.models.task_instance import TaskStatus


class MedicationTodayItem(BaseModel):
    medication_dose_instance_id: int
    medication_plan_id: int
    name: str
    instructions: str
    scheduled_at: datetime
    status: MedicationDoseStatus


class MedicationHistoryItem(BaseModel):
    medication_dose_instance_id: int
    medication_plan_id: int
    name: str
    instructions: str
    scheduled_at: datetime
    status: MedicationDoseStatus


class RoutineTodayItem(BaseModel):
    task_instance_id: int
    routine_template_id: int
    title: str
    status: TaskStatus
    scheduled_date: date
    due_at: datetime | None = None


class OverdueTodayItem(BaseModel):
    chore_instance_id: int
    chore_template_id: int
    title: str
    status: ChoreStatus
    overdue_since: date


class DueTodayItem(BaseModel):
    chore_instance_id: int
    chore_template_id: int
    title: str
    status: ChoreStatus
    scheduled_date: date


class UpcomingTodayItem(BaseModel):
    chore_instance_id: int
    chore_template_id: int
    title: str
    scheduled_date: date


class PlannedTodayItem(BaseModel):
    id: int
    title: str
    planned_for: date
    notes: str | None = None
    is_done: bool


class PlannedItemCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    planned_for: date
    notes: str | None = Field(default=None, max_length=4000)


class PlannedItemUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    planned_for: date
    notes: str | None = Field(default=None, max_length=4000)
    is_done: bool = False


class UnifiedDayItem(BaseModel):
    item_type: Literal["routine", "chore", "medication", "planned"]
    item_id: int
    title: str
    status: str
    scheduled_at: datetime | None = None
    scheduled_date: date | None = None
    detail: str | None = None


class CalendarDayResponse(BaseModel):
    date: date
    items: list[UnifiedDayItem]


class CalendarMonthDaySummary(BaseModel):
    date: date
    total: int
    routines: int
    chores: int
    medications: int
    planned: int


class CalendarMonthResponse(BaseModel):
    year: int
    month: int
    days: list[CalendarMonthDaySummary]


class TodayResponse(BaseModel):
    medication: list[MedicationTodayItem]
    medication_history: list[MedicationHistoryItem]
    routines: list[RoutineTodayItem]
    overdue: list[OverdueTodayItem]
    due_today: list[DueTodayItem]
    upcoming: list[UpcomingTodayItem]
    planned: list[PlannedTodayItem]
    day_items: list[UnifiedDayItem]


class ChoreInstanceMutationResponse(BaseModel):
    chore_instance_id: int
    status: ChoreStatus
    scheduled_date: date


class RescheduleChoreRequest(BaseModel):
    scheduled_date: date = Field(..., description="New date for the chore instance")
