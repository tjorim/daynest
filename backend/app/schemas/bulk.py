import enum

from pydantic import Field

from app.schemas.base import RequestModel, ResponseModel


class MutationType(str, enum.Enum):
    complete_chore = "complete_chore"
    skip_chore = "skip_chore"
    mark_planned_done = "mark_planned_done"


class BulkMutationItem(RequestModel):
    type: MutationType
    id: int


class BulkMutationRequest(RequestModel):
    mutations: list[BulkMutationItem] = Field(..., min_length=1, max_length=100)


class BulkMutationResult(ResponseModel):
    type: MutationType
    id: int
    success: bool
    error: str | None = None


class BulkMutationResponse(ResponseModel):
    results: list[BulkMutationResult]
