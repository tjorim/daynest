from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class TodaySummary(BaseModel):
    overdue_count: int
    tasks_remaining: int
    next_medication: str | None = None


class IntegrationCapabilities(BaseModel):
    home_assistant: bool
    mcp_adapter: bool
    export_import: bool


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
    medication_due_count: int
    completion_ratio: float
    next_medication: str | None = None
