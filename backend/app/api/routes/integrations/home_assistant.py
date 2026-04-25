from datetime import date

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.dependencies.integration_auth import require_integration_scope
from app.db.session import get_db
from app.models.user import User
from app.repositories.today_repository import TodayRepository
from app.schemas.integration_contracts import (
    HOME_ASSISTANT_ADAPTER,
    HOME_ASSISTANT_CONTRACT_VERSION,
    INTEGRATION_CONTRACT_HEADER,
    integration_contract_header,
)
from app.schemas.integrations import DashboardReadModel, HomeAssistantEntity
from app.services.today_service import TodayService

router = APIRouter(prefix="/integrations/home-assistant", tags=["integrations"])


def _set_ha_contract_header(response: Response) -> None:
    response.headers[INTEGRATION_CONTRACT_HEADER] = integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)


@router.get("/summary")
def home_assistant_summary(
    db: Session = Depends(get_db),
    integration_user: User = Depends(require_integration_scope("ha:read")),
    _: None = Depends(_set_ha_contract_header),
) -> dict[str, str | int | None]:
    service = TodayService(TodayRepository(db))
    summary = service.get_summary(user_id=integration_user.id, for_date=date.today())
    return {
        "todo_daynest_today": summary.tasks_remaining,
        "sensor_daynest_overdue_count": summary.overdue_count,
        "sensor_daynest_next_medication": summary.next_medication,
    }


@router.get("/entities", response_model=list[HomeAssistantEntity])
def home_assistant_entities(
    db: Session = Depends(get_db),
    integration_user: User = Depends(require_integration_scope("ha:read")),
    _: None = Depends(_set_ha_contract_header),
) -> list[HomeAssistantEntity]:
    service = TodayService(TodayRepository(db))
    read_model = service.get_dashboard_read_model(user_id=integration_user.id, for_date=date.today())
    return [
        HomeAssistantEntity(
            entity_id="todo.daynest_tasks",
            state=str(read_model.due_today_count),
            attributes={"friendly_name": "Daynest Tasks Due Today", "unit_of_measurement": "tasks"},
        ),
        HomeAssistantEntity(
            entity_id="sensor.daynest_overdue_count",
            state=str(read_model.overdue_count),
            attributes={"friendly_name": "Daynest Overdue Count"},
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
    db: Session = Depends(get_db),
    integration_user: User = Depends(require_integration_scope("ha:read")),
    _: None = Depends(_set_ha_contract_header),
) -> DashboardReadModel:
    service = TodayService(TodayRepository(db))
    return service.get_dashboard_read_model(user_id=integration_user.id, for_date=date.today())
