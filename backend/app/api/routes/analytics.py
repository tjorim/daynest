from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.repositories.analytics_repository import get_chore_stats, get_medication_stats, get_planned_item_stats, get_routine_stats
from app.schemas.analytics import AnalyticsSummaryResponse

router = APIRouter(prefix="/analytics", tags=["analytics"])

AnalyticsPeriod = Literal["week", "month", "year"]


def _period_start(today: date, period: AnalyticsPeriod) -> date:
    if period == "week":
        return today - timedelta(days=6)
    if period == "month":
        return today - timedelta(days=29)
    return today - timedelta(days=364)


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    period: AnalyticsPeriod = Query(default="week"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsSummaryResponse:
    end_date = date.today()
    start_date = _period_start(end_date, period)
    return AnalyticsSummaryResponse(
        period=period,
        start_date=start_date,
        end_date=end_date,
        chores=get_chore_stats(db, current_user.id, start_date, end_date),
        medications=get_medication_stats(db, current_user.id, start_date, end_date),
        planned_items=get_planned_item_stats(db, current_user.id, start_date, end_date),
        routines=get_routine_stats(db, current_user.id, start_date, end_date),
    )
