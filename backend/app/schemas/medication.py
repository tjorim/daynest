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
    is_active: bool = True


class MedicationPlanResponse(BaseModel):
    id: int
    name: str
    instructions: str
    start_date: date
    schedule_time: time
    every_n_days: int
    is_active: bool


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
