from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.medication_plan import MedicationPlan
from app.models.user import User
from app.repositories.today_repository import TodayRepository
from app.schemas.medication import (
    MedicationDoseMutationResponse,
    MedicationHistoryItem,
    MedicationHistoryResponse,
    MedicationPlanCreateRequest,
    MedicationPlanResponse,
)
from app.services.today_service import TodayService

router = APIRouter(tags=["medications"])


def _mutate_medication_dose_action(
    medication_dose_instance_id: int,
    action: str,
    db: Session,
    current_user: User,
) -> MedicationDoseMutationResponse:
    repository = TodayRepository(db)
    service = TodayService(repository)
    dose = service.mutate_medication_status(
        user_id=current_user.id,
        medication_dose_instance_id=medication_dose_instance_id,
        action=action,
    )
    return MedicationDoseMutationResponse(
        medication_dose_instance_id=dose.id,
        status=dose.status,
        scheduled_date=dose.scheduled_date,
    )


@router.get("/medications", response_model=list[MedicationPlanResponse])
def list_medications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MedicationPlanResponse]:
    repository = TodayRepository(db)
    plans = repository.list_medication_plans(user_id=current_user.id)
    return [
        MedicationPlanResponse(
            id=plan.id,
            name=plan.name,
            instructions=plan.instructions,
            start_date=plan.start_date,
            schedule_time=plan.schedule_time,
            every_n_days=plan.every_n_days,
            is_active=plan.is_active,
        )
        for plan in plans
    ]


@router.post("/medications", response_model=MedicationPlanResponse)
def create_medication(
    request: MedicationPlanCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicationPlanResponse:
    repository = TodayRepository(db)
    plan = repository.add_medication_plan(
        MedicationPlan(
            user_id=current_user.id,
            name=request.name,
            instructions=request.instructions,
            start_date=request.start_date,
            schedule_time=request.schedule_time,
            every_n_days=request.every_n_days,
            is_active=True,
        )
    )
    return MedicationPlanResponse(
        id=plan.id,
        name=plan.name,
        instructions=plan.instructions,
        start_date=plan.start_date,
        schedule_time=plan.schedule_time,
        every_n_days=plan.every_n_days,
        is_active=plan.is_active,
    )


@router.post("/medication-doses/{medication_dose_instance_id}/take", response_model=MedicationDoseMutationResponse)
def take_medication_dose(
    medication_dose_instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicationDoseMutationResponse:
    return _mutate_medication_dose_action(medication_dose_instance_id, "take", db, current_user)


@router.post("/medication-doses/{medication_dose_instance_id}/skip", response_model=MedicationDoseMutationResponse)
def skip_medication_dose(
    medication_dose_instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicationDoseMutationResponse:
    return _mutate_medication_dose_action(medication_dose_instance_id, "skip", db, current_user)


@router.post("/medication-doses/{medication_dose_instance_id}/miss", response_model=MedicationDoseMutationResponse)
def miss_medication_dose(
    medication_dose_instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicationDoseMutationResponse:
    return _mutate_medication_dose_action(medication_dose_instance_id, "miss", db, current_user)


@router.get("/medication-doses/history", response_model=MedicationHistoryResponse)
def medication_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicationHistoryResponse:
    repository = TodayRepository(db)
    history = repository.get_medication_history(user_id=current_user.id, before_date=datetime.now(timezone.utc).date())
    return MedicationHistoryResponse(
        history=[
            MedicationHistoryItem(
                medication_dose_instance_id=item.id,
                medication_plan_id=item.medication_plan_id,
                name=item.name,
                instructions=item.instructions,
                scheduled_at=item.scheduled_at,
                status=item.status,
            )
            for item in history
        ]
    )
