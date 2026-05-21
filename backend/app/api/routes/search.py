from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
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
    pattern = f"%{q}%"
    uid = current_user.id

    routines = (
        db.query(RoutineTemplate)
        .filter(
            RoutineTemplate.user_id == uid,
            (RoutineTemplate.name.ilike(pattern)) | (RoutineTemplate.description.ilike(pattern)),
        )
        .order_by(RoutineTemplate.name)
        .limit(limit)
        .all()
    )

    chores = (
        db.query(ChoreTemplate)
        .filter(
            ChoreTemplate.user_id == uid,
            (ChoreTemplate.name.ilike(pattern)) | (ChoreTemplate.description.ilike(pattern)),
        )
        .order_by(ChoreTemplate.name)
        .limit(limit)
        .all()
    )

    medications = (
        db.query(MedicationPlan)
        .filter(
            MedicationPlan.user_id == uid,
            (MedicationPlan.name.ilike(pattern)) | (MedicationPlan.instructions.ilike(pattern)),
        )
        .order_by(MedicationPlan.name)
        .limit(limit)
        .all()
    )

    planned = (
        db.query(PlannedItem)
        .filter(
            PlannedItem.user_id == uid,
            (PlannedItem.title.ilike(pattern)) | (PlannedItem.notes.ilike(pattern)),
        )
        .order_by(PlannedItem.planned_for.desc(), PlannedItem.title)
        .limit(limit)
        .all()
    )

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
                priority=c.priority.value if hasattr(c.priority, "value") else c.priority,
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
                priority=p.priority.value if hasattr(p.priority, "value") else p.priority,
                tags=p.tags or [],
                is_done=p.is_done,
                created_at=p.created_at,
            )
            for p in planned
        ],
    )
