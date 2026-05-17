from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


class CompleteTaskRequest(BaseModel):
    chore_instance_id: int = Field(gt=0, description="The chore instance ID to mark as complete")


class SnoozeTaskRequest(BaseModel):
    chore_instance_id: int = Field(gt=0, description="The chore instance ID to reschedule")
    days: int = Field(default=1, ge=1, le=30, description="Number of days to snooze the task")


class MarkMedicationTakenRequest(BaseModel):
    medication_dose_id: int = Field(gt=0, description="The medication dose instance ID to mark as taken")


class SkipTaskRequest(BaseModel):
    chore_instance_id: int = Field(gt=0, description="The chore instance ID to skip")


class SkipMedicationRequest(BaseModel):
    medication_dose_id: int = Field(gt=0, description="The medication dose instance ID to skip")


PlannedItemModuleKey = Literal["shopping_list", "meal_planning", "recurring_grocery", "shared_calendar"]


class PlannedItemCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    planned_for: date
    notes: str | None = Field(default=None, max_length=4000)
    module_key: PlannedItemModuleKey | None = None
    recurrence_hint: str | None = Field(default=None, max_length=255)
    linked_source: str | None = Field(default=None, max_length=120)
    linked_ref: str | None = Field(default=None, max_length=255)


class PlannedItemUpdateRequest(PlannedItemCreateRequest):
    is_done: bool = False


class HAActionResult(BaseModel):
    success: bool
    detail: str



class IntegrationClientCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    scopes: list[str] = Field(min_length=1)
    rate_limit_per_minute: int = Field(default=120, ge=10, le=600)


class IntegrationClientCreateResponse(BaseModel):
    id: int
    name: str
    scopes: list[str]
    rate_limit_per_minute: int
    api_key: str


class IntegrationClientResponse(BaseModel):
    id: int
    name: str
    scopes: list[str]
    rate_limit_per_minute: int
    is_active: bool


class HomeAssistantEntity(BaseModel):
    entity_id: str
    state: str
    attributes: dict[str, Any]


class DashboardReadModel(BaseModel):
    for_date: date
    overdue_count: int
    due_today_count: int
    planned_count: int
    planned_remaining_count: int = 0
    medication_due_count: int
    completion_ratio: float
    next_medication: str | None = None
    routines_open_count: int = 0


class HACalendarEvent(BaseModel):
    uid: str
    summary: str
    start: dict[str, str]
    end: dict[str, str]
    description: str | None = None
