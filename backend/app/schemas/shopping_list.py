from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator

from app.schemas.base import RequestModel
from app.schemas.types import NonEmptyText255, Text255, Text4000

ShoppingListStatus = Literal["active", "archived"]


class ShoppingListCreateRequest(RequestModel):
    name: NonEmptyText255
    store: Text255 | None = None
    notes: Text4000 | None = None


class ShoppingListUpdateRequest(RequestModel):
    name: NonEmptyText255 | None = None
    store: Text255 | None = None
    notes: Text4000 | None = None
    status: ShoppingListStatus | None = None

    @model_validator(mode="after")
    def non_clearable_fields_cannot_be_null(self) -> ShoppingListUpdateRequest:
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be set to null")
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("status cannot be set to null")
        return self


class ShoppingListResponse(BaseModel):
    id: int
    user_id: int
    name: str
    store: str | None
    notes: str | None
    status: ShoppingListStatus
    created_at: datetime
