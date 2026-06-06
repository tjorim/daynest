from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

ShoppingListStatus = Literal["active", "archived"]


class ShoppingListCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    store: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=4000)


class ShoppingListUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    store: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=4000)
    status: ShoppingListStatus | None = None

    @model_validator(mode="after")
    def non_clearable_fields_cannot_be_null(self) -> "ShoppingListUpdateRequest":
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
