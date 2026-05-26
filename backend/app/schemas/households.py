from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.enums import HouseholdMemberRole


class HouseholdCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class HouseholdUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class HouseholdMemberResponse(BaseModel):
    user_id: int
    email: str
    full_name: str | None
    role: HouseholdMemberRole
    joined_at: datetime


class HouseholdResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    members: list[HouseholdMemberResponse]


class InviteRequest(BaseModel):
    email: EmailStr = Field(..., description="Email of the user to invite")
