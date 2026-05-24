from datetime import date, datetime, time

from pydantic import BaseModel, Field

from app.core.enums import MedicationDoseStatus


class MedicationPlanBase(BaseModel):
    name: str
    instructions: str
    start_date: date
    schedule_time: time
    every_n_days: int = Field(default=1, ge=1)


class MedicationPlanCreateRequest(MedicationPlanBase):
    pass


class MedicationPlanUpdateRequest(MedicationPlanBase):
    is_active: bool


class MedicationPlanResponse(BaseModel):
    id: int
    name: str
    instructions: str
    start_date: date
    schedule_time: time
    every_n_days: int
    is_active: bool


class MedicationDoseTakeRequest(BaseModel):
    taken_at: datetime | None = Field(
        default=None,
        description="Optional timestamp when the dose was actually taken. Must not be in the future. Defaults to now.",
    )


class SkipMissedDosesRequest(BaseModel):
    before_date: date | None = Field(
        default=None,
        description="Skip all missed doses with scheduled_date strictly before this date. Defaults to today.",
    )


class SkipMissedDosesResponse(BaseModel):
    skipped_count: int
    before_date: date


class MedicationDoseMutationResponse(BaseModel):
    medication_dose_instance_id: int
    status: MedicationDoseStatus
    scheduled_date: date


class MedicationHistoryItem(BaseModel):
    medication_dose_instance_id: int
    medication_plan_id: int
    name: str
    instructions: str
    scheduled_at: datetime
    status: MedicationDoseStatus


class MedicationHistoryResponse(BaseModel):
    history: list[MedicationHistoryItem]
