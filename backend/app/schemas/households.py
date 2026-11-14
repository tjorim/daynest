from datetime import datetime

from pydantic import EmailStr, Field

from app.core.enums import HouseholdMemberRole
from app.schemas.base import NonEmptyText255, RequestModel, ResponseModel


class HouseholdCreateRequest(RequestModel):
    name: NonEmptyText255


class HouseholdUpdateRequest(RequestModel):
    name: NonEmptyText255


class HouseholdMemberResponse(ResponseModel):
    user_id: int
    email: str
    full_name: str | None
    role: HouseholdMemberRole
    joined_at: datetime


class HouseholdResponse(ResponseModel):
    id: int
    name: str
    created_at: datetime
    members: list[HouseholdMemberResponse]


class InviteRequest(RequestModel):
    email: EmailStr = Field(..., description="Email of the user to invite")
