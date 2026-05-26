from datetime import date, datetime, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.core.enums import ChoreStatus, MedicationDoseStatus, Priority, TaskStatus


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
    household_id: int | None = None
    assigned_to: int | None = None
    completed_by: int | None = None


class DueTodayItem(BaseModel):
    chore_instance_id: int
    chore_template_id: int
    title: str
    status: ChoreStatus
    scheduled_date: date
    household_id: int | None = None
    assigned_to: int | None = None
    completed_by: int | None = None


class UpcomingTodayItem(BaseModel):
    chore_instance_id: int
    chore_template_id: int
    title: str
    scheduled_date: date
    household_id: int | None = None
    assigned_to: int | None = None


PlannedItemModuleKey = Literal["shopping_list", "meal_planning", "recurring_grocery", "shared_calendar"]


class PlannedTodayItem(BaseModel):
    id: int
    title: str
    planned_for: date
    time_of_day: time | None = None
    duration_minutes: int | None = None
    notes: str | None = None
    module_key: PlannedItemModuleKey | None = None
    recurrence_hint: str | None = None
    rrule: str | None = None
    recurrence_series_id: UUID | None = None
    linked_source: str | None = None
    linked_ref: str | None = None
    priority: Priority = Priority.normal
    tags: list[str] = Field(default_factory=list)
    is_done: bool


class PlannedItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    planned_for: date
    time_of_day: time | None = None
    duration_minutes: int | None = Field(default=None, ge=1)
    notes: str | None = Field(default=None, max_length=4000)
    module_key: PlannedItemModuleKey | None = None
    recurrence_hint: str | None = Field(default=None, max_length=255)
    rrule: str | None = Field(default=None, max_length=500)
    linked_source: str | None = Field(default=None, max_length=120)
    linked_ref: str | None = Field(default=None, max_length=255)
    priority: Priority = Priority.normal
    tags: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _apply_module_defaults(self) -> "PlannedItemBase":
        if self.module_key == "recurring_grocery" and self.recurrence_hint is None:
            self.recurrence_hint = "weekly"
        return self


class PlannedItemCreateRequest(PlannedItemBase):
    pass


class PlannedItemUpdateRequest(PlannedItemBase):
    is_done: bool = False


class UnifiedDayItem(BaseModel):
    item_type: Literal["routine", "chore", "medication", "planned"]
    item_id: int
    title: str
    status: str
    scheduled_at: datetime | None = None
    scheduled_date: date | None = None
    detail: str | None = None
    module_key: PlannedItemModuleKey | None = None
    rrule: str | None = None
    recurrence_series_id: str | None = None
    recurrence_hint: str | None = None
    linked_source: str | None = None
    linked_ref: str | None = None
    priority: Priority = Priority.normal


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
    completed_at: datetime | None = None
    skipped_at: datetime | None = None
    assigned_to: int | None = None
    completed_by: int | None = None


class TaskInstanceMutationResponse(BaseModel):
    task_instance_id: int
    status: TaskStatus
    scheduled_date: date
    due_at: datetime | None = None
    completed_at: datetime | None = None


class RescheduleChoreRequest(BaseModel):
    scheduled_date: date = Field(..., description="New date for the chore instance")


class AssignChoreRequest(BaseModel):
    assigned_to: int | None = Field(default=None, description="User ID to assign the chore to, or null to unassign")
