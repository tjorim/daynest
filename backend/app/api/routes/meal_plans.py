from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.repositories.meal_plan_repository import MealPlanRepository
from app.schemas.meal_plan import (
    GenerateShoppingListResponse,
    MealPlanCreate,
    MealPlanResponse,
    MealPlanUpdate,
    MealSlotResponse,
    MealSlotUpdate,
    WeekGridResponse,
)
from app.services.meal_plan_service import MealPlanService

router = APIRouter(tags=["meal-plans"])


def _service(db: Session) -> MealPlanService:
    return MealPlanService(MealPlanRepository(db))


@router.get("", response_model=list[MealPlanResponse])
def list_meal_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MealPlanResponse]:
    return _service(db).list_meal_plans(current_user.id)


@router.post("", response_model=MealPlanResponse, status_code=status.HTTP_201_CREATED)
def create_meal_plan(
    request: MealPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MealPlanResponse:
    return _service(db).create_meal_plan(current_user.id, request)


@router.get("/{meal_plan_id}", response_model=MealPlanResponse)
def get_meal_plan(
    meal_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MealPlanResponse:
    return _service(db).get_meal_plan(current_user.id, meal_plan_id)


@router.put("/{meal_plan_id}", response_model=MealPlanResponse)
def update_meal_plan(
    meal_plan_id: int,
    request: MealPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MealPlanResponse:
    return _service(db).update_meal_plan(current_user.id, meal_plan_id, request)


@router.delete("/{meal_plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_plan(
    meal_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    _service(db).delete_meal_plan(current_user.id, meal_plan_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{meal_plan_id}/slots", response_model=WeekGridResponse)
def get_week_plan(
    meal_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeekGridResponse:
    return _service(db).get_week_plan(current_user.id, meal_plan_id)


@router.put("/{meal_plan_id}/slots/{slot_id}", response_model=MealSlotResponse)
def update_meal_slot(
    meal_plan_id: int,
    slot_id: int,
    request: MealSlotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MealSlotResponse:
    return _service(db).update_slot(current_user.id, meal_plan_id, slot_id, request)


@router.post("/{meal_plan_id}/generate-shopping-list", response_model=GenerateShoppingListResponse)
def generate_shopping_list(
    meal_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GenerateShoppingListResponse:
    return _service(db).generate_shopping_list(plan_id=meal_plan_id, user_id=current_user.id)
