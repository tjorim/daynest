from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.repositories.today_repository import TodayRepository
from app.schemas.today import (
    CalendarDayResponse,
    CalendarMonthResponse,
    ChoreInstanceMutationResponse,
    PlannedItemCreateRequest,
    PlannedItemUpdateRequest,
    PlannedTodayItem,
    RescheduleChoreRequest,
    TodayResponse,
)
from app.services.today_service import TodayService

router = APIRouter(tags=["today"])


@router.get("/today", response_model=TodayResponse)
def get_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TodayResponse:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.get_today(user_id=current_user.id, for_date=date.today())


@router.get("/calendar/month", response_model=CalendarMonthResponse)
def get_calendar_month(
    year: int = Query(..., ge=1970, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarMonthResponse:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.get_month(user_id=current_user.id, year=year, month=month)


@router.get("/calendar/day", response_model=CalendarDayResponse)
def get_calendar_day(
    target_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarDayResponse:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.get_day_items(user_id=current_user.id, for_date=target_date)


@router.get("/planned-items", response_model=list[PlannedTodayItem])
def list_planned_items(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PlannedTodayItem]:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.list_planned_items(user_id=current_user.id, start_date=start_date, end_date=end_date)


@router.post("/planned-items", response_model=PlannedTodayItem)
def create_planned_item(
    request: PlannedItemCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlannedTodayItem:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.create_planned_item(user_id=current_user.id, request=request)


@router.put("/planned-items/{planned_item_id}", response_model=PlannedTodayItem)
def update_planned_item(
    planned_item_id: int,
    request: PlannedItemUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlannedTodayItem:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.update_planned_item(user_id=current_user.id, planned_item_id=planned_item_id, request=request)


@router.delete("/planned-items/{planned_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_planned_item(
    planned_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    repository = TodayRepository(db)
    service = TodayService(repository)
    service.delete_planned_item(user_id=current_user.id, planned_item_id=planned_item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/chores/{chore_instance_id}/complete", response_model=ChoreInstanceMutationResponse)
def complete_chore(
    chore_instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChoreInstanceMutationResponse:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.complete_chore(user_id=current_user.id, chore_instance_id=chore_instance_id)


@router.post("/chores/{chore_instance_id}/skip", response_model=ChoreInstanceMutationResponse)
def skip_chore(
    chore_instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChoreInstanceMutationResponse:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.skip_chore(user_id=current_user.id, chore_instance_id=chore_instance_id)


@router.post("/chores/{chore_instance_id}/reschedule", response_model=ChoreInstanceMutationResponse)
def reschedule_chore(
    chore_instance_id: int,
    request: RescheduleChoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChoreInstanceMutationResponse:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.reschedule_chore(
        user_id=current_user.id,
        chore_instance_id=chore_instance_id,
        scheduled_date=request.scheduled_date,
    )
