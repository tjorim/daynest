"""Owner-scoped analytics and cross-module search MCP operations."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.mcp.context import jsonable, with_principal
from app.mcp.errors import map_domain_errors
from app.mcp.principal import McpPrincipal
from app.models.chore_template import ChoreTemplate
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
from app.models.routine_template import RoutineTemplate
from app.repositories.analytics_repository import (
    get_chore_stats,
    get_medication_stats,
    get_planned_item_stats,
    get_routine_stats,
)
from app.schemas.analytics import AnalyticsSummaryResponse

SessionFactory = Callable[[], Session]
AnalyticsPeriod = Literal["week", "month", "year"]
_ESCAPE_CHAR = "\\"


@map_domain_errors
def get_analytics_summary(
    session_factory: SessionFactory,
    user_email: str | None,
    period: AnalyticsPeriod = "week",
) -> dict[str, Any]:
    """Return owner-scoped completion and adherence statistics."""
    days = {"week": 6, "month": 29, "year": 364}[period]

    def _op(db: Session, principal: McpPrincipal) -> dict[str, Any]:
        end_date = datetime.now(UTC).date()
        start_date = end_date - timedelta(days=days)
        return jsonable(
            AnalyticsSummaryResponse(
                period=period,
                start_date=start_date,
                end_date=end_date,
                chores=get_chore_stats(db, principal.user.id, start_date, end_date),
                medications=get_medication_stats(
                    db, principal.user.id, start_date, end_date
                ),
                planned_items=get_planned_item_stats(
                    db, principal.user.id, start_date, end_date
                ),
                routines=get_routine_stats(db, principal.user.id, start_date, end_date),
            )
        )

    return with_principal(session_factory, user_email, _op)


@map_domain_errors
def search_daynest(
    session_factory: SessionFactory, user_email: str | None, query: str, limit: int = 20
) -> dict[str, Any]:
    """Search the owner's routines, chores, medications, and planned items."""
    query = query.strip()
    if not 2 <= len(query) <= 100:
        raise ValueError("query must contain between 2 and 100 characters")
    limit = max(1, min(limit, 100))
    escaped = (
        query.replace(_ESCAPE_CHAR, _ESCAPE_CHAR * 2)
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
    pattern = f"%{escaped}%"

    def _op(db: Session, principal: McpPrincipal) -> dict[str, Any]:
        uid = principal.user.id
        specs = (
            (
                "routine_templates",
                RoutineTemplate,
                RoutineTemplate.name,
                RoutineTemplate.description,
            ),
            (
                "chore_templates",
                ChoreTemplate,
                ChoreTemplate.name,
                ChoreTemplate.description,
            ),
            (
                "medication_plans",
                MedicationPlan,
                MedicationPlan.name,
                MedicationPlan.instructions,
            ),
            ("planned_items", PlannedItem, PlannedItem.title, PlannedItem.notes),
        )
        result: dict[str, Any] = {"query": query}
        for key, model, title, detail in specs:
            rows = db.scalars(
                select(model)
                .where(
                    model.user_id == uid,
                    title.ilike(pattern, escape=_ESCAPE_CHAR)
                    | detail.ilike(pattern, escape=_ESCAPE_CHAR),
                )
                .order_by(title)
                .limit(limit)
            ).all()
            result[key] = [
                {
                    "id": row.id,
                    "title": getattr(row, "title", getattr(row, "name", "")),
                    "description": getattr(
                        row,
                        "description",
                        getattr(row, "instructions", getattr(row, "notes", None)),
                    ),
                }
                for row in rows
            ]
        result["count"] = sum(len(result[key]) for key, *_ in specs)
        return jsonable(result)

    return with_principal(session_factory, user_email, _op)
