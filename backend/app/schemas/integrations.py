from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.base import NonEmptyText255, RequestModel, ResponseModel, Text255, Text4000
from app.schemas.today import DueTodayItem, MedicationTodayItem, PlannedTodayItem


class CompleteTaskRequest(RequestModel):
    chore_instance_id: int = Field(gt=0, description="The chore instance ID to mark as complete")


class SnoozeTaskRequest(RequestModel):
    chore_instance_id: int = Field(gt=0, description="The chore instance ID to reschedule")
    days: int = Field(default=1, ge=1, le=30, description="Number of days to snooze the task")


class MarkMedicationTakenRequest(RequestModel):
    medication_dose_id: int = Field(gt=0, description="The medication dose instance ID to mark as taken")


class SkipTaskRequest(RequestModel):
    chore_instance_id: int = Field(gt=0, description="The chore instance ID to skip")


class SkipMedicationRequest(RequestModel):
    medication_dose_id: int = Field(gt=0, description="The medication dose instance ID to skip")


class MarkPlannedDoneRequest(RequestModel):
    planned_item_id: int = Field(gt=0, description="The planned item ID to mark as done")


PlannedItemModuleKey = Literal["shopping_list", "meal_planning", "recurring_grocery", "shared_calendar"]


class HomeAssistantPlannedItemCreateRequest(RequestModel):
    title: NonEmptyText255
    planned_for: date
    notes: Text4000 | None = None
    module_key: PlannedItemModuleKey | None = None
    recurrence_hint: Text255 | None = None
    linked_source: str | None = Field(default=None, max_length=120)
    linked_ref: Text255 | None = None


class HomeAssistantPlannedItemUpdateRequest(HomeAssistantPlannedItemCreateRequest, RequestModel):
    is_done: bool = False


class HAActionResult(ResponseModel):
    success: bool
    detail: str


class HomeAssistantSummaryResponse(ResponseModel):
    """Flat sensor values of ``GET /integrations/home-assistant/summary``; every key is always sent."""

    sensor_daynest_chores_due: int
    sensor_daynest_routines_open: int
    sensor_daynest_medication_due: int
    sensor_daynest_planned_remaining: int
    sensor_daynest_overdue_count: int
    sensor_daynest_next_medication: str | None


IntegrationScope = Literal["home_assistant:*", "pebble:read", "pebble:write"]


def _default_integration_scopes() -> list[IntegrationScope]:
    return ["home_assistant:*"]


class IntegrationClientCreateRequest(RequestModel):
    name: str = Field(min_length=2, max_length=120)
    rate_limit_per_minute: int = Field(default=120, ge=10, le=600)
    scopes: list[IntegrationScope] = Field(
        default_factory=_default_integration_scopes,
        min_length=1,
    )


class IntegrationClientCreateResponse(ResponseModel):
    id: int
    name: str
    rate_limit_per_minute: int
    scopes: list[str]
    api_key: str
    client_id: str
    client_secret: str
    token_url: str


class IntegrationClientTokenResponse(ResponseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int


class IntegrationClientResponse(ResponseModel):
    id: int
    name: str
    rate_limit_per_minute: int
    scopes: list[str]
    is_active: bool
    key_preview: str | None
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None


class HomeAssistantEntity(ResponseModel):
    entity_id: str
    state: str
    attributes: dict[str, Any]


class DashboardReadModel(ResponseModel):
    for_date: date
    overdue_count: int
    due_today_count: int
    planned_count: int
    planned_remaining_count: int = 0
    medication_due_count: int
    completion_ratio: float
    next_medication: str | None = None
    routines_open_count: int = 0
    due_today: list[DueTodayItem] = []
    planned: list[PlannedTodayItem] = []
    chores: list[DueTodayItem] = []
    medications: list[MedicationTodayItem] = []
    planned_items: list[PlannedTodayItem] = []


class HomeAssistantOIDCConfig(ResponseModel):
    authorization_url: str
    token_url: str
    client_id: str


class HACalendarEvent(ResponseModel):
    uid: str
    summary: str
    start: dict[str, str]
    end: dict[str, str]
    description: str | None = None
