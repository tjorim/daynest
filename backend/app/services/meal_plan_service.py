from datetime import timedelta

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.enums import Priority
from app.models.meal_plan import MealPlan, MealSlot
from app.repositories.meal_plan_repository import MealPlanRepository
from app.repositories.shopping_list_repository import ShoppingListRepository
from app.repositories.today_repository import TodayRepository
from app.schemas.meal_plan import (
    MEAL_SLOT_TYPES,
    GenerateShoppingListResponse,
    MealPlanCreate,
    MealPlanResponse,
    MealPlanUpdate,
    MealSlotResponse,
    MealSlotUpdate,
    WeekDayResponse,
    WeekGridResponse,
)
from app.schemas.shopping_list import ShoppingListCreateRequest
from app.schemas.today import PlannedTodayItem
from app.services.shopping_list_service import ShoppingListService
from app.services.today_service import TodayService


class MealPlanService:
    def __init__(self, repository: MealPlanRepository):
        self.repository = repository

    def list_meal_plans(self, user_id: int) -> list[MealPlanResponse]:
        return [self._plan_to_schema(plan) for plan in self.repository.list_by_user(user_id)]

    def get_meal_plan(self, user_id: int, meal_plan_id: int) -> MealPlanResponse:
        return self._plan_to_schema(self._get_user_plan(user_id, meal_plan_id))

    def create_meal_plan(self, user_id: int, request: MealPlanCreate) -> MealPlanResponse:
        plan = self.repository.create(
            MealPlan(user_id=user_id, name=request.name, week_start=request.week_start, notes=request.notes)
        )
        return self._plan_to_schema(plan)

    def update_meal_plan(self, user_id: int, meal_plan_id: int, request: MealPlanUpdate) -> MealPlanResponse:
        plan = self._get_user_plan(user_id, meal_plan_id, include_slots=True)
        if "name" in request.model_fields_set and request.name is not None:
            plan.name = request.name
        if "week_start" in request.model_fields_set and request.week_start is not None:
            plan.week_start = request.week_start
        if "notes" in request.model_fields_set:
            plan.notes = request.notes
        return self._plan_to_schema(self.repository.update(plan))

    def delete_meal_plan(self, user_id: int, meal_plan_id: int) -> None:
        self.repository.delete(self._get_user_plan(user_id, meal_plan_id))

    def get_week_plan(self, user_id: int, meal_plan_id: int) -> WeekGridResponse:
        plan = self._get_user_plan(user_id, meal_plan_id, include_slots=True)
        return self._week_grid_to_schema(plan)

    def update_slot(self, user_id: int, meal_plan_id: int, slot_id: int, request: MealSlotUpdate) -> MealSlotResponse:
        self._get_user_plan(user_id, meal_plan_id)
        slot = self.repository.get_slot(user_id=user_id, meal_plan_id=meal_plan_id, slot_id=slot_id)
        if slot is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found")
        if "title" in request.model_fields_set and request.title is not None:
            slot.title = request.title
        if "recipe_url" in request.model_fields_set:
            slot.recipe_url = request.recipe_url
        if "ingredients_json" in request.model_fields_set and request.ingredients_json is not None:
            slot.ingredients_json = request.ingredients_json
        if "planned_item_id" in request.model_fields_set:
            slot.planned_item_id = request.planned_item_id
        return self._slot_to_schema(self.repository.save_slot(slot))

    def generate_shopping_list(self, plan_id: int, user_id: int) -> GenerateShoppingListResponse:
        plan = self._get_user_plan(user_id, plan_id, include_slots=True)
        ingredients: list[str] = []
        seen: set[str] = set()
        for slot in sorted(plan.slots, key=lambda item: (item.slot_date, item.slot_type, item.id)):
            for ingredient in slot.ingredients_json or []:
                normalized = ingredient.strip()
                if not normalized:
                    continue
                key = normalized.casefold()
                if key in seen:
                    continue
                seen.add(key)
                ingredients.append(normalized)

        if not ingredients:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Meal plan has no ingredients")

        today_service = TodayService(TodayRepository(self.repository.db), app_settings=settings)
        shopping_service = ShoppingListService(ShoppingListRepository(self.repository.db), today_service)
        shopping_list = shopping_service.create_shopping_list(
            user_id=user_id,
            request=ShoppingListCreateRequest(name=f"Meal plan: {plan.name}", notes=f"Generated from meal plan #{plan.id}"),
        )
        items: list[PlannedTodayItem] = []
        for ingredient in ingredients:
            item = shopping_service.add_shopping_item(
                user_id=user_id,
                shopping_list_id=shopping_list.id,
                title=ingredient,
                planned_for=plan.week_start,
                notes=f"Generated from meal plan '{plan.name}'",
                priority=Priority.normal,
                tags=["meal-planning"],
            )
            items.append(PlannedTodayItem.model_validate(item))

        return GenerateShoppingListResponse(shopping_list=shopping_list, items=items)

    def _get_user_plan(self, user_id: int, meal_plan_id: int, *, include_slots: bool = False) -> MealPlan:
        plan = self.repository.get_by_id(user_id=user_id, meal_plan_id=meal_plan_id, include_slots=include_slots)
        if plan is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal plan not found")
        return plan

    @staticmethod
    def _plan_to_schema(plan: MealPlan) -> MealPlanResponse:
        return MealPlanResponse(
            id=plan.id,
            user_id=plan.user_id,
            name=plan.name,
            week_start=plan.week_start,
            notes=plan.notes,
            created_at=plan.created_at,
        )

    @staticmethod
    def _slot_to_schema(slot: MealSlot) -> MealSlotResponse:
        return MealSlotResponse(
            id=slot.id,
            meal_plan_id=slot.meal_plan_id,
            slot_date=slot.slot_date,
            slot_type=slot.slot_type,  # type: ignore[arg-type]
            title=slot.title,
            recipe_url=slot.recipe_url,
            ingredients_json=slot.ingredients_json or [],
            planned_item_id=slot.planned_item_id,
        )

    def _week_grid_to_schema(self, plan: MealPlan) -> WeekGridResponse:
        slot_lookup = {(slot.slot_date, slot.slot_type): slot for slot in plan.slots}
        days = []
        for offset in range(7):
            slot_date = plan.week_start + timedelta(days=offset)
            slots = {
                slot_type: self._slot_to_schema(slot_lookup[(slot_date, slot_type)])
                for slot_type in MEAL_SLOT_TYPES
                if (slot_date, slot_type) in slot_lookup
            }
            days.append(WeekDayResponse(date=slot_date, slots=slots))
        return WeekGridResponse(meal_plan=self._plan_to_schema(plan), days=days)
