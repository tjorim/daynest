"""Narrow API surface for the Daynest Pebble app."""

from datetime import date

from fastapi import APIRouter, Depends

from app.api.dependencies.integration_auth import require_integration_auth
from app.api.dependencies.today import get_today_service
from app.models.user import User
from app.schemas.integrations import (
    CompleteTaskRequest,
    DashboardReadModel,
    HAActionResult,
    SkipTaskRequest,
)
from app.services.today_service import TodayService

router = APIRouter(prefix="/integrations/pebble", tags=["integrations"])


@router.get("/dashboard", response_model=DashboardReadModel)
def pebble_dashboard(
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth("pebble:read")),
) -> DashboardReadModel:
    return service.get_dashboard_read_model(user_id=integration_user.id, for_date=date.today())


@router.post("/actions/complete-task", response_model=HAActionResult)
def pebble_complete_task(
    request: CompleteTaskRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth("pebble:write")),
) -> HAActionResult:
    service.complete_chore(user_id=integration_user.id, chore_instance_id=request.chore_instance_id)
    return HAActionResult(success=True, detail=f"Task {request.chore_instance_id} marked as complete")


@router.post("/actions/skip-task", response_model=HAActionResult)
def pebble_skip_task(
    request: SkipTaskRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth("pebble:write")),
) -> HAActionResult:
    service.skip_chore(user_id=integration_user.id, chore_instance_id=request.chore_instance_id)
    return HAActionResult(success=True, detail=f"Task {request.chore_instance_id} skipped")
