from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.dependencies.integration_auth import require_integration_scope
from app.db.session import get_db
from app.models.user import User
from app.repositories.today_repository import TodayRepository
from app.schemas.integration_contracts import (
    INTEGRATION_CONTRACT_HEADER,
    MCP_ADAPTER,
    MCP_CONTRACT_VERSION,
    integration_contract_header,
)
from app.schemas.integrations import IntegrationCapabilities
from app.schemas.today import CalendarDayResponse, TodayResponse
from app.services.today_service import TodayService

router = APIRouter(prefix="/mcp", tags=["integrations"])


def _set_mcp_contract_header(response: Response) -> None:
    response.headers[INTEGRATION_CONTRACT_HEADER] = integration_contract_header(MCP_ADAPTER, MCP_CONTRACT_VERSION)


@router.get("/capabilities")
def mcp_capabilities(
    integration_user: User = Depends(require_integration_scope("mcp:read")),
    _: None = Depends(_set_mcp_contract_header),
) -> IntegrationCapabilities:
    return IntegrationCapabilities(
        home_assistant=True,
        mcp_adapter=True,
        export_import=False,
    )


@router.get("/today", response_model=TodayResponse)
def mcp_today(
    db: Session = Depends(get_db),
    integration_user: User = Depends(require_integration_scope("mcp:read")),
    _: None = Depends(_set_mcp_contract_header),
) -> TodayResponse:
    service = TodayService(TodayRepository(db))
    return service.get_today(user_id=integration_user.id, for_date=date.today())


@router.get("/calendar/day", response_model=CalendarDayResponse)
def mcp_day(
    target_date: date = Query(default_factory=date.today, alias="date"),
    db: Session = Depends(get_db),
    integration_user: User = Depends(require_integration_scope("mcp:read")),
    _: None = Depends(_set_mcp_contract_header),
) -> CalendarDayResponse:
    service = TodayService(TodayRepository(db))
    return service.get_day_items(user_id=integration_user.id, for_date=target_date)
