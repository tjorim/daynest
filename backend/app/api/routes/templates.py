from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.chore_template import ChoreTemplate
from app.models.routine_template import RoutineTemplate
from app.models.user import User
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
        is_active=template.is_active,
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


@router.get("/routines", response_model=list[RoutineTemplateResponse])
def list_routines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RoutineTemplateResponse]:
    repository = TodayRepository(db)
    return [_routine_to_response(item) for item in repository.list_routine_templates(current_user.id)]


@router.post("/routines", response_model=RoutineTemplateResponse)
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
    template.name = request.name
    template.description = request.description
    template.start_date = request.start_date
    template.every_n_days = request.every_n_days
    template.due_time = request.due_time
    template.is_active = request.is_active
    repository.save()
    db.refresh(template)
    return _routine_to_response(template)


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


@router.get("/chore-templates", response_model=list[ChoreTemplateResponse])
def list_chore_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChoreTemplateResponse]:
    repository = TodayRepository(db)
    return [_chore_to_response(item) for item in repository.list_chore_templates(current_user.id)]


@router.post("/chore-templates", response_model=ChoreTemplateResponse)
def create_chore_template(
    request: ChoreTemplateCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChoreTemplateResponse:
    repository = TodayRepository(db)
    template = repository.add_chore_template(
        ChoreTemplate(
            user_id=current_user.id,
            name=request.name,
            description=request.description,
            start_date=request.start_date,
            every_n_days=request.every_n_days,
            is_active=request.is_active,
        )
    )
    return _chore_to_response(template)


@router.put("/chore-templates/{chore_template_id}", response_model=ChoreTemplateResponse)
def update_chore_template(
    chore_template_id: int,
    request: ChoreTemplateUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChoreTemplateResponse:
    repository = TodayRepository(db)
    template = _get_user_chore_template(repository, current_user.id, chore_template_id)
    template.name = request.name
    template.description = request.description
    template.start_date = request.start_date
    template.every_n_days = request.every_n_days
    template.is_active = request.is_active
    repository.save()
    db.refresh(template)
    return _chore_to_response(template)


@router.delete("/chore-templates/{chore_template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chore_template(
    chore_template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    repository = TodayRepository(db)
    template = _get_user_chore_template(repository, current_user.id, chore_template_id)
    repository.delete_chore_template(template)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
