from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

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


class ShoppingListResponse(BaseModel):
    id: int
    user_id: int
    name: str
    store: str | None
    notes: str | None
    status: ShoppingListStatus
    created_at: datetime
