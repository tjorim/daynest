from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.shopping_list import ShoppingListResponse
from app.schemas.today import PlannedTodayItem

MealSlotType = Literal["breakfast", "lunch", "dinner", "snack"]
MEAL_SLOT_TYPES: tuple[MealSlotType, ...] = ("breakfast", "lunch", "dinner", "snack")


class MealPlanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    week_start: date
    notes: str | None = Field(default=None, max_length=4000)


class MealPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    week_start: date | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def non_clearable_fields_cannot_be_null(self) -> "MealPlanUpdate":
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be set to null")
        if "week_start" in self.model_fields_set and self.week_start is None:
            raise ValueError("week_start cannot be set to null")
        return self


class MealSlotUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    recipe_url: str | None = Field(default=None, max_length=4000)
    ingredients_json: list[str] | None = Field(default=None, max_length=100)
    planned_item_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def normalize_ingredients(self) -> "MealSlotUpdate":
        if self.ingredients_json is not None:
            self.ingredients_json = [ingredient.strip() for ingredient in self.ingredients_json if ingredient.strip()]
        return self


class MealSlotResponse(BaseModel):
    id: int
    meal_plan_id: int
    slot_date: date
    slot_type: MealSlotType
    title: str
    recipe_url: str | None = None
    ingredients_json: list[str] = Field(default_factory=list)
    planned_item_id: int | None = None


class MealPlanResponse(BaseModel):
    id: int
    user_id: int
    name: str
    week_start: date
    notes: str | None = None
    created_at: datetime


class WeekDayResponse(BaseModel):
    date: date
    slots: dict[MealSlotType, MealSlotResponse]


class WeekGridResponse(BaseModel):
    meal_plan: MealPlanResponse
    days: list[WeekDayResponse]


class GenerateShoppingListResponse(BaseModel):
    shopping_list: ShoppingListResponse
    items: list[PlannedTodayItem]
