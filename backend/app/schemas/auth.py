from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, field_validator


class UserMeResponse(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    is_active: bool
    timezone: str = "UTC"
    roles: list[str] = []


class UserUpdateRequest(BaseModel):
    timezone: str

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, KeyError):
            raise ValueError(f"Unknown timezone: {v!r}. Use an IANA timezone name such as 'Europe/Brussels'.")
        return v
