from datetime import date, datetime, time

from pydantic import BaseModel, Field


class RoutineTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    start_date: date
    every_n_days: int = Field(default=1, ge=1)
    due_time: time | None = None
    is_active: bool = True


class RoutineTemplateCreateRequest(RoutineTemplateBase):
    pass


class RoutineTemplateUpdateRequest(RoutineTemplateBase):
    pass


class RoutineTemplateResponse(RoutineTemplateBase):
    id: int
    created_at: datetime


class ChoreTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    start_date: date
    every_n_days: int = Field(default=1, ge=1)
    is_active: bool = True


class ChoreTemplateCreateRequest(ChoreTemplateBase):
    pass


class ChoreTemplateUpdateRequest(ChoreTemplateBase):
    pass


class ChoreTemplateResponse(ChoreTemplateBase):
    id: int
    created_at: datetime
