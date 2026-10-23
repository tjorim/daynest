from datetime import date, datetime, time

from pydantic import BaseModel, Field, PositiveInt

from app.core.enums import Priority
from app.schemas.base import NonEmptyText255, RequestModel, Text4000


class RoutineTemplateBase(BaseModel):
    name: NonEmptyText255
    description: Text4000 | None = None
    start_date: date
    every_n_days: int = Field(default=1, ge=1)
    rrule: str | None = Field(default=None, max_length=500)
    due_time: time | None = None
    is_active: bool = True


class RoutineTemplateCreateRequest(RoutineTemplateBase, RequestModel):
    pass


class RoutineTemplateUpdateRequest(RoutineTemplateBase, RequestModel):
    pass


class RoutineTemplateResponse(RoutineTemplateBase):
    id: int
    created_at: datetime


class ChoreTemplateBase(BaseModel):
    name: NonEmptyText255
    description: Text4000 | None = None
    start_date: date
    every_n_days: int = Field(default=1, ge=1)
    rrule: str | None = Field(default=None, max_length=500)
    priority: Priority = Priority.normal
    tags: list[str] = Field(default_factory=list)
    is_active: bool = True
    household_id: PositiveInt | None = None


class ChoreTemplateCreateRequest(ChoreTemplateBase, RequestModel):
    pass


class ChoreTemplateUpdateRequest(ChoreTemplateBase, RequestModel):
    pass


class ChoreTemplateResponse(ChoreTemplateBase):
    id: int
    created_at: datetime
