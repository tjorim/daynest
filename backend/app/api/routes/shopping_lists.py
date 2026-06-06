from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.repositories.shopping_list_repository import ShoppingListRepository
from app.repositories.today_repository import TodayRepository
from app.schemas.today import PlannedTodayItem
from app.schemas.shopping_list import (
    ShoppingListCreateRequest,
    ShoppingListResponse,
    ShoppingListStatus,
    ShoppingListUpdateRequest,
)
from app.services.shopping_list_service import ShoppingListService
from app.services.today_service import TodayService

router = APIRouter(tags=["shopping-lists"])


def _service(db: Session) -> ShoppingListService:
    return ShoppingListService(
        repository=ShoppingListRepository(db),
        today_service=TodayService(TodayRepository(db), app_settings=settings),
    )


@router.get("", response_model=list[ShoppingListResponse])
def list_shopping_lists(
    status_filter: ShoppingListStatus | Literal["all"] = Query(
        default="active", alias="status"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ShoppingListResponse]:
    return _service(db).list_shopping_lists(
        user_id=current_user.id,
        status_filter=None if status_filter == "all" else status_filter,
    )


@router.post(
    "", response_model=ShoppingListResponse, status_code=status.HTTP_201_CREATED
)
def create_shopping_list(
    request: ShoppingListCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShoppingListResponse:
    return _service(db).create_shopping_list(user_id=current_user.id, request=request)


@router.get("/{shopping_list_id}", response_model=ShoppingListResponse)
def get_shopping_list(
    shopping_list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShoppingListResponse:
    return _service(db).get_shopping_list(
        user_id=current_user.id, shopping_list_id=shopping_list_id
    )


@router.put("/{shopping_list_id}", response_model=ShoppingListResponse)
def update_shopping_list(
    shopping_list_id: int,
    request: ShoppingListUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShoppingListResponse:
    return _service(db).update_shopping_list(
        user_id=current_user.id, shopping_list_id=shopping_list_id, request=request
    )


@router.post("/{shopping_list_id}/import-recurring", response_model=list[PlannedTodayItem])
def import_recurring_groceries(
    shopping_list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PlannedTodayItem]:
    return _service(db).import_recurring_groceries(
        user_id=current_user.id, shopping_list_id=shopping_list_id
    )


@router.delete("/{shopping_list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shopping_list(
    shopping_list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    _service(db).delete_shopping_list(
        user_id=current_user.id, shopping_list_id=shopping_list_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
