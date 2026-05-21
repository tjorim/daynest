from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.chore_template import ChoreTemplate
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
from app.models.routine_template import RoutineTemplate
from app.models.user import User

router = APIRouter(prefix="/search", tags=["search"])

_DEFAULT_LIMIT = 20
_ESCAPE_CHAR = "\\"


def _like_pattern(q: str) -> str:
    escaped = q.replace(_ESCAPE_CHAR, _ESCAPE_CHAR * 2).replace("%", f"{_ESCAPE_CHAR}%").replace("_", f"{_ESCAPE_CHAR}_")
    return f"%{escaped}%"


class RoutineSearchResult(BaseModel):
    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime


class ChoreSearchResult(BaseModel):
    id: int
    name: str
    description: str | None
    priority: str
    tags: list[str]
    is_active: bool
    created_at: datetime


class MedicationSearchResult(BaseModel):
    id: int
    name: str
    instructions: str
    is_active: bool
    created_at: datetime


class PlannedItemSearchResult(BaseModel):
    id: int
    title: str
    notes: str | None
    planned_for: date
    priority: str
    tags: list[str]
    is_done: bool
    created_at: datetime


class SearchResponse(BaseModel):
    query: str
    routine_templates: list[RoutineSearchResult]
    chore_templates: list[ChoreSearchResult]
    medication_plans: list[MedicationSearchResult]
    planned_items: list[PlannedItemSearchResult]


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResponse:
    pattern = _like_pattern(q)
    uid = current_user.id

    routines = db.scalars(
        select(RoutineTemplate)
        .where(
            RoutineTemplate.user_id == uid,
            (RoutineTemplate.name.ilike(pattern, escape=_ESCAPE_CHAR))
            | (RoutineTemplate.description.ilike(pattern, escape=_ESCAPE_CHAR)),
        )
        .order_by(RoutineTemplate.name)
        .limit(limit)
    ).all()

    chores = db.scalars(
        select(ChoreTemplate)
        .where(
            ChoreTemplate.user_id == uid,
            (ChoreTemplate.name.ilike(pattern, escape=_ESCAPE_CHAR))
            | (ChoreTemplate.description.ilike(pattern, escape=_ESCAPE_CHAR)),
        )
        .order_by(ChoreTemplate.name)
        .limit(limit)
    ).all()

    medications = db.scalars(
        select(MedicationPlan)
        .where(
            MedicationPlan.user_id == uid,
            (MedicationPlan.name.ilike(pattern, escape=_ESCAPE_CHAR))
            | (MedicationPlan.instructions.ilike(pattern, escape=_ESCAPE_CHAR)),
        )
        .order_by(MedicationPlan.name)
        .limit(limit)
    ).all()

    planned = db.scalars(
        select(PlannedItem)
        .where(
            PlannedItem.user_id == uid,
            (PlannedItem.title.ilike(pattern, escape=_ESCAPE_CHAR))
            | (PlannedItem.notes.ilike(pattern, escape=_ESCAPE_CHAR)),
        )
        .order_by(PlannedItem.planned_for.desc(), PlannedItem.title)
        .limit(limit)
    ).all()

    return SearchResponse(
        query=q,
        routine_templates=[
            RoutineSearchResult(
                id=r.id,
                name=r.name,
                description=r.description,
                is_active=r.is_active,
                created_at=r.created_at,
            )
            for r in routines
        ],
        chore_templates=[
            ChoreSearchResult(
                id=c.id,
                name=c.name,
                description=c.description,
                priority=c.priority,
                tags=c.tags or [],
                is_active=c.is_active,
                created_at=c.created_at,
            )
            for c in chores
        ],
        medication_plans=[
            MedicationSearchResult(
                id=m.id,
                name=m.name,
                instructions=m.instructions,
                is_active=m.is_active,
                created_at=m.created_at,
            )
            for m in medications
        ],
        planned_items=[
            PlannedItemSearchResult(
                id=p.id,
                title=p.title,
                notes=p.notes,
                planned_for=p.planned_for,
                priority=p.priority,
                tags=p.tags or [],
                is_done=p.is_done,
                created_at=p.created_at,
            )
            for p in planned
        ],
    )
