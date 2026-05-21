from datetime import time

from pydantic import BaseModel, Field


class UserSettingsResponse(BaseModel):
    timezone: str
    default_snooze_days: int
    medication_reminder_minutes: int
    quiet_hours_start: time | None
    quiet_hours_end: time | None


class UserSettingsPatchRequest(BaseModel):
    timezone: str | None = Field(default=None, max_length=100)
    default_snooze_days: int | None = Field(default=None, ge=1)
    medication_reminder_minutes: int | None = Field(default=None, ge=0)
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None
