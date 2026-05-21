import enum

from pydantic import BaseModel, Field


class MutationType(str, enum.Enum):
    complete_chore = "complete_chore"
    skip_chore = "skip_chore"
    mark_planned_done = "mark_planned_done"


class BulkMutationItem(BaseModel):
    type: MutationType
    id: int


class BulkMutationRequest(BaseModel):
    mutations: list[BulkMutationItem] = Field(..., min_length=1, max_length=100)


class BulkMutationResult(BaseModel):
    type: MutationType
    id: int
    success: bool
    error: str | None = None


class BulkMutationResponse(BaseModel):
    results: list[BulkMutationResult]
