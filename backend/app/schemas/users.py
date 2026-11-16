from datetime import time

from pydantic import Field, JsonValue

from app.core.enums import ChoreStatus, MedicationDoseStatus, Priority, TaskStatus
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


class ExportUserSettings(ResponseModel):
    # Exported strings stay strings: do not parse/reformat naive times or datetimes.
    timezone: str
    default_snooze_days: int
    medication_reminder_minutes: int
    quiet_hours_start: str | None
    quiet_hours_end: str | None
    push_overdue_chores_enabled: bool
    push_medication_reminders_enabled: bool
    push_missed_medications_enabled: bool


class ExportRoutineTemplate(ResponseModel):
    id: int
    name: str
    description: str | None
    start_date: str
    every_n_days: int
    rrule: str | None
    due_time: str | None
    is_active: bool
    created_at: str


class ExportChoreTemplate(ResponseModel):
    id: int
    name: str
    description: str | None
    start_date: str
    every_n_days: int
    rrule: str | None
    priority: Priority
    tags: list[JsonValue]
    is_active: bool
    created_at: str


class ExportMedicationPlan(ResponseModel):
    id: int
    name: str
    instructions: str
    start_date: str
    schedule_time: str
    every_n_days: int
    is_active: bool
    created_at: str


class ExportTaskInstance(ResponseModel):
    id: int
    routine_template_id: int
    title: str
    scheduled_date: str
    due_at: str | None
    status: TaskStatus
    completed_at: str | None
    created_at: str


class ExportChoreInstance(ResponseModel):
    id: int
    chore_template_id: int
    title: str
    scheduled_date: str
    status: ChoreStatus
    completed_at: str | None
    skipped_at: str | None
    created_at: str


class ExportMedicationDoseInstance(ResponseModel):
    id: int
    medication_plan_id: int
    name: str
    instructions: str
    scheduled_date: str
    scheduled_at: str
    status: MedicationDoseStatus
    taken_at: str | None
    skipped_at: str | None
    missed_at: str | None
    created_at: str


class ExportPlannedItem(ResponseModel):
    id: int
    title: str
    notes: str | None
    module_key: str | None
    recurrence_hint: str | None
    linked_source: str | None
    linked_ref: str | None
    planned_for: str
    priority: Priority
    tags: list[JsonValue]
    is_done: bool
    completed_at: str | None
    created_at: str


class UserExportResponse(ResponseModel):
    """The JSON form of ``GET /users/me/export``; the same document ``POST /users/me/import`` accepts.

    Rows describe the explicit export field lists in ``export_import_service``. Dates and times remain
    strings to preserve the exporter's exact formatting; private/household columns stay excluded.
    """

    version: int
    exported_at: str
    user_settings: ExportUserSettings
    routine_templates: list[ExportRoutineTemplate]
    chore_templates: list[ExportChoreTemplate]
    medication_plans: list[ExportMedicationPlan]
    task_instances: list[ExportTaskInstance]
    chore_instances: list[ExportChoreInstance]
    medication_dose_instances: list[ExportMedicationDoseInstance]
    planned_items: list[ExportPlannedItem]


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
