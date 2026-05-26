from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.chore_template import ChoreTemplate
from app.models.routine_template import RoutineTemplate
from app.models.user import User
from app.repositories.household_repository import HouseholdRepository
from app.repositories.today_repository import TodayRepository
from app.schemas.templates import (
    ChoreTemplateCreateRequest,
    ChoreTemplateResponse,
    ChoreTemplateUpdateRequest,
    RoutineTemplateCreateRequest,
    RoutineTemplateResponse,
    RoutineTemplateUpdateRequest,
)

router = APIRouter(tags=["templates"])


def _routine_to_response(template: RoutineTemplate) -> RoutineTemplateResponse:
    return RoutineTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        start_date=template.start_date,
        every_n_days=template.every_n_days,
        rrule=template.rrule,
        due_time=template.due_time,
        is_active=template.is_active,
        created_at=template.created_at,
    )


def _chore_to_response(template: ChoreTemplate) -> ChoreTemplateResponse:
    return ChoreTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        start_date=template.start_date,
        every_n_days=template.every_n_days,
        rrule=template.rrule,
        priority=template.priority,
        tags=template.tags or [],
        is_active=template.is_active,
        household_id=template.household_id,
        created_at=template.created_at,
    )


def _get_user_routine_template(repository: TodayRepository, user_id: int, routine_template_id: int) -> RoutineTemplate:
    template = repository.get_routine_template_for_user(user_id=user_id, routine_template_id=routine_template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine template not found")
    return template


def _get_user_chore_template(repository: TodayRepository, user_id: int, chore_template_id: int) -> ChoreTemplate:
    template = repository.get_chore_template_for_user(user_id=user_id, chore_template_id=chore_template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chore template not found")
    return template


def _validate_household_membership(db: Session, user_id: int, household_id: int) -> None:
    """Raise 403 if user is not a member of the given household."""
    household_repo = HouseholdRepository(db)
    membership = household_repo.get_membership(household_id=household_id, user_id=user_id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this household",
        )


@router.get("/routines", response_model=list[RoutineTemplateResponse])
def list_routines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RoutineTemplateResponse]:
    repository = TodayRepository(db)
    return [_routine_to_response(item) for item in repository.list_routine_templates(current_user.id)]


@router.post("/routines", response_model=RoutineTemplateResponse, status_code=201)
def create_routine(
    request: RoutineTemplateCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RoutineTemplateResponse:
    repository = TodayRepository(db)
    template = repository.add_routine_template(
        RoutineTemplate(
            user_id=current_user.id,
            name=request.name,
            description=request.description,
            start_date=request.start_date,
            every_n_days=request.every_n_days,
            rrule=request.rrule,
            due_time=request.due_time,
            is_active=request.is_active,
        )
    )
    return _routine_to_response(template)


@router.put("/routines/{routine_template_id}", response_model=RoutineTemplateResponse)
def update_routine(
    routine_template_id: int,
    request: RoutineTemplateUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RoutineTemplateResponse:
    repository = TodayRepository(db)
    template = _get_user_routine_template(repository, current_user.id, routine_template_id)
    updated = repository.update_routine_template(
        template,
        name=request.name,
        description=request.description,
        start_date=request.start_date,
        every_n_days=request.every_n_days,
        rrule=request.rrule,
        due_time=request.due_time,
        is_active=request.is_active,
    )
    return _routine_to_response(updated)


@router.delete("/routines/{routine_template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_routine(
    routine_template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    repository = TodayRepository(db)
    template = _get_user_routine_template(repository, current_user.id, routine_template_id)
    repository.delete_routine_template(template)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/chores", response_model=list[ChoreTemplateResponse])
def list_chore_templates(
    tags: str | None = Query(default=None, description="Comma-separated tags to filter by (OR match)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChoreTemplateResponse]:
    repository = TodayRepository(db)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    return [_chore_to_response(item) for item in repository.list_chore_templates(current_user.id, tags=tag_list)]


@router.post("/chores", response_model=ChoreTemplateResponse, status_code=201)
def create_chore_template(
    request: ChoreTemplateCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChoreTemplateResponse:
    if request.household_id is not None:
        _validate_household_membership(db, current_user.id, request.household_id)
    repository = TodayRepository(db)
    template = repository.add_chore_template(
        ChoreTemplate(
            user_id=current_user.id,
            name=request.name,
            description=request.description,
            start_date=request.start_date,
            every_n_days=request.every_n_days,
            rrule=request.rrule,
            priority=request.priority,
            tags=request.tags,
            is_active=request.is_active,
            household_id=request.household_id,
        )
    )
    return _chore_to_response(template)


@router.put("/chores/{chore_template_id}", response_model=ChoreTemplateResponse)
def update_chore_template(
    chore_template_id: int,
    request: ChoreTemplateUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChoreTemplateResponse:
    if request.household_id is not None:
        _validate_household_membership(db, current_user.id, request.household_id)
    repository = TodayRepository(db)
    template = _get_user_chore_template(repository, current_user.id, chore_template_id)
    if template.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the template owner can update this chore template",
        )
    updated = repository.update_chore_template(
        template,
        name=request.name,
        description=request.description,
        start_date=request.start_date,
        every_n_days=request.every_n_days,
        rrule=request.rrule,
        priority=request.priority,
        tags=request.tags,
        is_active=request.is_active,
        household_id=request.household_id,
    )
    return _chore_to_response(updated)


@router.delete("/chores/{chore_template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chore_template(
    chore_template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    repository = TodayRepository(db)
    template = _get_user_chore_template(repository, current_user.id, chore_template_id)
    if template.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the template owner can delete this chore template",
        )
    repository.delete_chore_template(template)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
