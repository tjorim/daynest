from datetime import date, datetime

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


class TodayResponse(BaseModel):
    medication: list[MedicationTodayItem]
    medication_history: list[MedicationHistoryItem]
    routines: list[RoutineTodayItem]
    overdue: list[OverdueTodayItem]
    due_today: list[DueTodayItem]
    upcoming: list[UpcomingTodayItem]
    planned: list[PlannedTodayItem]


class ChoreInstanceMutationResponse(BaseModel):
    chore_instance_id: int
    status: ChoreStatus
    scheduled_date: date


class RescheduleChoreRequest(BaseModel):
    scheduled_date: date = Field(..., description="New date for the chore instance")
