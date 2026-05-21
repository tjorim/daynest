from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.dependencies.integration_auth import require_integration_auth
from app.api.dependencies.today import get_today_service
from app.core.config import settings
from app.models.user import User
from app.schemas.integration_contracts import (
    HOME_ASSISTANT_ADAPTER,
    HOME_ASSISTANT_CONTRACT_VERSION,
    INTEGRATION_CONTRACT_HEADER,
    integration_contract_header,
)
from app.schemas.integrations import (
    CompleteTaskRequest,
    DashboardReadModel,
    HAActionResult,
    HACalendarEvent,
    HomeAssistantEntity,
    HomeAssistantOIDCConfig,
    MarkMedicationTakenRequest,
    MarkPlannedDoneRequest,
    PlannedItemCreateRequest,
    PlannedItemUpdateRequest,
    SkipMedicationRequest,
    SkipTaskRequest,
    SnoozeTaskRequest,
)
from app.schemas.today import PlannedItemCreateRequest as TodayPlannedItemCreateRequest
from app.schemas.today import PlannedItemUpdateRequest as TodayPlannedItemUpdateRequest
from app.services.today_service import TodayService

_HA_OIDC_CLIENT_ID = "home-assistant"

router = APIRouter(prefix="/integrations/home-assistant", tags=["integrations"])


def _set_ha_contract_header(response: Response) -> None:
    response.headers[INTEGRATION_CONTRACT_HEADER] = integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)


@router.get("/oidc-config", response_model=HomeAssistantOIDCConfig)
def home_assistant_oidc_config() -> HomeAssistantOIDCConfig:
    """Return OIDC endpoint URLs for the Home Assistant integration config flow (unauthenticated)."""
    if not settings.oidc_issuer_url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OIDC not configured on this server")
    issuer = settings.oidc_issuer_url.rstrip("/")
    return HomeAssistantOIDCConfig(
        authorization_url=f"{issuer}/protocol/openid-connect/auth",
        token_url=f"{issuer}/protocol/openid-connect/token",
        client_id=_HA_OIDC_CLIENT_ID,
    )


@router.get("/summary")
def home_assistant_summary(
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
    _: None = Depends(_set_ha_contract_header),
) -> dict[str, str | int | None]:
    read_model = service.get_dashboard_read_model(user_id=integration_user.id, for_date=date.today())
    return {
        "sensor_daynest_chores_due": read_model.due_today_count,
        "sensor_daynest_routines_open": read_model.routines_open_count,
        "sensor_daynest_medication_due": read_model.medication_due_count,
        "sensor_daynest_planned_remaining": read_model.planned_remaining_count,
        "sensor_daynest_overdue_count": read_model.overdue_count,
        "sensor_daynest_next_medication": read_model.next_medication,
    }


@router.get("/entities", response_model=list[HomeAssistantEntity])
def home_assistant_entities(
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
    _: None = Depends(_set_ha_contract_header),
) -> list[HomeAssistantEntity]:
    read_model = service.get_dashboard_read_model(user_id=integration_user.id, for_date=date.today())
    return [
        HomeAssistantEntity(
            entity_id="sensor.daynest_chores_due",
            state=str(read_model.due_today_count),
            attributes={"friendly_name": "Daynest Chores Due Today", "unit_of_measurement": "chores"},
        ),
        HomeAssistantEntity(
            entity_id="sensor.daynest_routines_open",
            state=str(read_model.routines_open_count),
            attributes={"friendly_name": "Daynest Routines Open", "unit_of_measurement": "routines"},
        ),
        HomeAssistantEntity(
            entity_id="sensor.daynest_medication_due",
            state=str(read_model.medication_due_count),
            attributes={"friendly_name": "Daynest Medication Due", "unit_of_measurement": "doses"},
        ),
        HomeAssistantEntity(
            entity_id="sensor.daynest_planned_remaining",
            state=str(read_model.planned_remaining_count),
            attributes={"friendly_name": "Daynest Planned Remaining", "unit_of_measurement": "items"},
        ),
        HomeAssistantEntity(
            entity_id="sensor.daynest_overdue_count",
            state=str(read_model.overdue_count),
            attributes={"friendly_name": "Daynest Overdue Count", "unit_of_measurement": "items"},
        ),
        HomeAssistantEntity(
            entity_id="sensor.daynest_completion_ratio",
            state=str(read_model.completion_ratio),
            attributes={"friendly_name": "Daynest Completion Ratio"},
        ),
        HomeAssistantEntity(
            entity_id="sensor.daynest_next_medication",
            state=read_model.next_medication or "none",
            attributes={"friendly_name": "Daynest Next Medication"},
        ),
    ]


@router.get("/dashboard", response_model=DashboardReadModel)
def home_assistant_dashboard(
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
    _: None = Depends(_set_ha_contract_header),
) -> DashboardReadModel:
    return service.get_dashboard_read_model(user_id=integration_user.id, for_date=date.today())


@router.get("/calendar", response_model=list[HACalendarEvent])
def home_assistant_calendar(
    start: date = Query(..., description="Inclusive start date in YYYY-MM-DD format"),
    end: date = Query(..., description="Inclusive end date in YYYY-MM-DD format"),
    event_type: Literal["chores", "medications", "planned_items"] | None = Query(
        default=None,
        description="Optional calendar event type filter",
    ),
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
    _: None = Depends(_set_ha_contract_header),
) -> list[HACalendarEvent]:
    """Return all scheduled events (chores, routines, medication, planned) for a date range."""
    event_types = {event_type} if event_type else None
    return service.get_calendar_events(
        user_id=integration_user.id,
        start_date=start,
        end_date=end,
        event_types=event_types,
    )


@router.post("/actions/complete-task", response_model=HAActionResult)
def home_assistant_complete_task(
    request: CompleteTaskRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
) -> HAActionResult:
    """Mark a chore instance as complete via Home Assistant automation."""
    service.complete_chore(user_id=integration_user.id, chore_instance_id=request.chore_instance_id)
    return HAActionResult(success=True, detail=f"Task {request.chore_instance_id} marked as complete")


@router.post("/actions/snooze-task", response_model=HAActionResult)
def home_assistant_snooze_task(
    request: SnoozeTaskRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
) -> HAActionResult:
    """Reschedule a chore instance N days into the future via Home Assistant automation."""
    new_date = date.today() + timedelta(days=request.days)
    service.reschedule_chore(user_id=integration_user.id, chore_instance_id=request.chore_instance_id, scheduled_date=new_date)
    return HAActionResult(success=True, detail=f"Task {request.chore_instance_id} rescheduled by {request.days} day(s)")


@router.post("/actions/mark-medication-taken", response_model=HAActionResult)
def home_assistant_mark_medication_taken(
    request: MarkMedicationTakenRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
) -> HAActionResult:
    """Mark a medication dose as taken via Home Assistant automation."""
    service.mutate_medication_status(
        user_id=integration_user.id,
        medication_dose_instance_id=request.medication_dose_id,
        action="take",
    )
    return HAActionResult(success=True, detail=f"Medication dose {request.medication_dose_id} marked as taken")


@router.post("/actions/skip-task", response_model=HAActionResult)
def home_assistant_skip_task(
    request: SkipTaskRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
) -> HAActionResult:
    """Skip a chore instance via Home Assistant automation."""
    service.skip_chore(user_id=integration_user.id, chore_instance_id=request.chore_instance_id)
    return HAActionResult(success=True, detail=f"Task {request.chore_instance_id} skipped")


@router.post("/actions/skip-medication", response_model=HAActionResult)
def home_assistant_skip_medication(
    request: SkipMedicationRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
) -> HAActionResult:
    """Skip a medication dose via Home Assistant automation."""
    service.mutate_medication_status(
        user_id=integration_user.id,
        medication_dose_instance_id=request.medication_dose_id,
        action="skip",
    )
    return HAActionResult(success=True, detail=f"Medication dose {request.medication_dose_id} skipped")


@router.post("/actions/mark-planned-done", response_model=HAActionResult)
def home_assistant_mark_planned_done(
    request: MarkPlannedDoneRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
) -> HAActionResult:
    """Mark a planned item as done via Home Assistant automation."""
    service.mark_planned_done(user_id=integration_user.id, planned_item_id=request.planned_item_id)
    return HAActionResult(success=True, detail=f"Planned item {request.planned_item_id} marked as done")


@router.post("/actions/create-planned-item", response_model=HAActionResult)
def home_assistant_create_planned_item(
    request: PlannedItemCreateRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
) -> HAActionResult:
    """Create a planned item via Home Assistant automation."""
    created = service.create_planned_item(
        user_id=integration_user.id,
        request=TodayPlannedItemCreateRequest(**request.model_dump()),
    )
    return HAActionResult(success=True, detail=f"Planned item {created.id} created")


@router.put("/actions/update-planned-item/{planned_item_id}", response_model=HAActionResult)
def home_assistant_update_planned_item(
    planned_item_id: int,
    request: PlannedItemUpdateRequest,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
) -> HAActionResult:
    """Update a planned item via Home Assistant automation."""
    service.update_planned_item(
        user_id=integration_user.id,
        planned_item_id=planned_item_id,
        request=TodayPlannedItemUpdateRequest(**request.model_dump()),
    )
    return HAActionResult(success=True, detail=f"Planned item {planned_item_id} updated")


@router.delete("/actions/delete-planned-item/{planned_item_id}", response_model=HAActionResult)
def home_assistant_delete_planned_item(
    planned_item_id: int,
    service: TodayService = Depends(get_today_service),
    integration_user: User = Depends(require_integration_auth()),
) -> HAActionResult:
    """Delete a planned item via Home Assistant automation."""
    service.delete_planned_item(user_id=integration_user.id, planned_item_id=planned_item_id)
    return HAActionResult(success=True, detail=f"Planned item {planned_item_id} deleted")
