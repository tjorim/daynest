"""Shopping-list and meal-planning MCP tools."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.core.enums import Priority
from app.mcp.context import (
    jsonable,
    parse_date,
    with_meal_plan_service,
    with_shopping_service,
)
from app.mcp.errors import map_domain_errors
from app.mcp.principal import McpPrincipal
from app.schemas.meal_plan import MealSlotUpdate
from app.schemas.shopping_list import ShoppingListCreateRequest, ShoppingListStatus
from app.services.meal_plan_service import MealPlanService
from app.services.shopping_list_service import ShoppingListService

SessionFactory = Callable[[], Session]


# --- Meal planning ---------------------------------------------------------


@map_domain_errors
def list_meal_plans(session_factory: SessionFactory, user_email: str | None) -> list[dict[str, Any]]:
    return with_meal_plan_service(
        session_factory, user_email, lambda _db, principal, service: jsonable(service.list_meal_plans(principal.user.id))
    )


@map_domain_errors
def get_week_plan(session_factory: SessionFactory, user_email: str | None, meal_plan_id: int) -> dict[str, Any]:
    return with_meal_plan_service(
        session_factory, user_email, lambda _db, principal, service: jsonable(service.get_week_plan(principal.user.id, meal_plan_id))
    )


@map_domain_errors
def set_meal_slot(
    session_factory: SessionFactory,
    user_email: str | None,
    meal_plan_id: int,
    slot_id: int,
    title: str | None = None,
    recipe_url: str | None = None,
    ingredients_json: list[str] | None = None,
    planned_item_id: int | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if title is not None:
        payload["title"] = title
    if recipe_url is not None:
        payload["recipe_url"] = None if recipe_url == "" else recipe_url
    if ingredients_json is not None:
        payload["ingredients_json"] = ingredients_json
    if planned_item_id is not None:
        payload["planned_item_id"] = None if planned_item_id == 0 else planned_item_id
    request = MealSlotUpdate(**payload)

    def _op(_db: Session, principal: McpPrincipal, service: MealPlanService) -> dict[str, Any]:
        return jsonable(service.update_slot(principal.user.id, meal_plan_id, slot_id, request, actor=principal.to_audit_actor()))

    return with_meal_plan_service(session_factory, user_email, _op)


@map_domain_errors
def generate_shopping_list_from_plan(session_factory: SessionFactory, user_email: str | None, meal_plan_id: int) -> dict[str, Any]:
    def _op(_db: Session, principal: McpPrincipal, service: MealPlanService) -> dict[str, Any]:
        return jsonable(service.generate_shopping_list(plan_id=meal_plan_id, user_id=principal.user.id, actor=principal.to_audit_actor()))

    return with_meal_plan_service(session_factory, user_email, _op)


# --- Shopping lists ----------------------------------------------------


@map_domain_errors
def list_shopping_lists(
    session_factory: SessionFactory, user_email: str | None, status: ShoppingListStatus | Literal["all"] = "active"
) -> list[dict[str, Any]]:
    status_filter = None if status == "all" else status
    return with_shopping_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(service.list_shopping_lists(principal.user.id, status_filter)),
    )


@map_domain_errors
def create_shopping_list(
    session_factory: SessionFactory, user_email: str | None, name: str, store: str | None = None, notes: str | None = None
) -> dict[str, Any]:
    request = ShoppingListCreateRequest(name=name, store=store, notes=notes)

    def _op(_db: Session, principal: McpPrincipal, service: ShoppingListService) -> dict[str, Any]:
        return jsonable(service.create_shopping_list(principal.user.id, request, actor=principal.to_audit_actor()))

    return with_shopping_service(session_factory, user_email, _op)


@map_domain_errors
def add_shopping_item(
    session_factory: SessionFactory,
    user_email: str | None,
    shopping_list_id: int,
    title: str,
    planned_for: str = "today",
    notes: str | None = None,
    priority: str = "normal",
    tags: list[str] | None = None,
) -> dict[str, Any]:
    def _op(_db: Session, principal: McpPrincipal, service: ShoppingListService) -> dict[str, Any]:
        return service.add_shopping_item(
            user_id=principal.user.id,
            shopping_list_id=shopping_list_id,
            title=title,
            planned_for=parse_date(planned_for),
            notes=notes,
            priority=Priority(priority),
            tags=tags or [],
            actor=principal.to_audit_actor(),
        )

    return with_shopping_service(session_factory, user_email, _op)


@map_domain_errors
def check_off_shopping_item(session_factory: SessionFactory, user_email: str | None, shopping_list_id: int, planned_item_id: int) -> dict[str, Any]:
    def _op(_db: Session, principal: McpPrincipal, service: ShoppingListService) -> dict[str, Any]:
        return service.check_off_shopping_item(
            user_id=principal.user.id,
            shopping_list_id=shopping_list_id,
            planned_item_id=planned_item_id,
            actor=principal.to_audit_actor(),
        )

    return with_shopping_service(session_factory, user_email, _op)
