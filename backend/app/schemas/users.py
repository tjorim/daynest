from datetime import time
from typing import Any

from pydantic import Field

from app.schemas.base import RequestModel, ResponseModel


class UserSettingsResponse(ResponseModel):
    timezone: str
    default_snooze_days: int
    medication_reminder_minutes: int
    quiet_hours_start: time | None
    quiet_hours_end: time | None
    push_overdue_chores_enabled: bool
    push_medication_reminders_enabled: bool
    push_missed_medications_enabled: bool


class UserSettingsPatchRequest(RequestModel):
    timezone: str | None = Field(default=None, max_length=100)
    default_snooze_days: int | None = Field(default=None, ge=1)
    medication_reminder_minutes: int | None = Field(default=None, ge=0)
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None
    push_overdue_chores_enabled: bool | None = None
    push_medication_reminders_enabled: bool | None = None
    push_missed_medications_enabled: bool | None = None


class UserExportResponse(ResponseModel):
    """The JSON form of ``GET /users/me/export``; the same document ``POST /users/me/import`` accepts.

    Rows are exported column by column from the database models (see ``export_import_service``), so they are
    described as open objects here rather than repeated as a second set of models.
    """

    version: int
    exported_at: str
    user_settings: dict[str, Any]
    routine_templates: list[dict[str, Any]]
    chore_templates: list[dict[str, Any]]
    medication_plans: list[dict[str, Any]]
    task_instances: list[dict[str, Any]]
    chore_instances: list[dict[str, Any]]
    medication_dose_instances: list[dict[str, Any]]
    planned_items: list[dict[str, Any]]


class UserImportCounts(ResponseModel):
    routine_templates: int
    chore_templates: int
    medication_plans: int
    task_instances: int
    chore_instances: int
    medication_dose_instances: int
    planned_items: int


class UserImportResponse(ResponseModel):
    imported: UserImportCounts
