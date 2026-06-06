"""Tests for meal-planning backend APIs and service behavior."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.main import app
from app.models.planned_item import PlannedItem
from app.schemas.meal_plan import MealPlanCreate
from app.models.user import User
from app.repositories.meal_plan_repository import MealPlanRepository
from app.services.meal_plan_service import MealPlanService


def _create_user(db_session: Session, email: str) -> User:
    user = User(
        email=email,
        full_name="Test User",
        password_hash="hashed-password",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _auth_as(user: User) -> None:
    async def _dep() -> User:
        return user

    app.dependency_overrides[get_current_user] = _dep


def _clear_auth() -> None:
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def clear_auth_override():
    yield
    _clear_auth()


# ── Routes ──────────────────────────────────────────────────────────────────


def test_create_meal_plan_and_week_grid_routes(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "meal-plan-route@example.com")
    _auth_as(user)

    response = client.post(
        "/api/meal-plans",
        json={"name": "Week 1", "week_start": "2026-06-08", "notes": "Simple meals"},
    )

    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Week 1"
    assert created["week_start"] == "2026-06-08"

    grid_response = client.get(f"/api/meal-plans/{created['id']}/slots")
    assert grid_response.status_code == 200
    grid = grid_response.json()
    assert grid["meal_plan"]["id"] == created["id"]
    assert len(grid["days"]) == 7
    assert set(grid["days"][0]["slots"].keys()) == {"breakfast", "lunch", "dinner", "snack"}

    breakfast_id = grid["days"][0]["slots"]["breakfast"]["id"]
    update_response = client.put(
        f"/api/meal-plans/{created['id']}/slots/{breakfast_id}",
        json={
            "title": "Oatmeal",
            "recipe_url": "https://example.com/oats",
            "ingredients_json": [" oats ", "Milk", ""],
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Oatmeal"
    assert update_response.json()["ingredients_json"] == ["oats", "Milk"]


def test_meal_plans_are_user_scoped(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "meal-owner@example.com")
    other = _create_user(db_session, "meal-other@example.com")
    _auth_as(owner)
    meal_plan_id = client.post(
        "/api/meal-plans", json={"name": "Private", "week_start": "2026-06-08"}
    ).json()["id"]

    _auth_as(other)
    assert client.get(f"/api/meal-plans/{meal_plan_id}").status_code == 404
    assert client.get(f"/api/meal-plans/{meal_plan_id}/slots").status_code == 404
    assert client.delete(f"/api/meal-plans/{meal_plan_id}").status_code == 404


def test_generate_shopping_list_from_meal_plan(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "meal-shopping@example.com")
    _auth_as(user)

    meal_plan_id = client.post(
        "/api/meal-plans", json={"name": "Dinner plan", "week_start": "2026-06-08"}
    ).json()["id"]
    grid = client.get(f"/api/meal-plans/{meal_plan_id}/slots").json()
    dinner_id = grid["days"][0]["slots"]["dinner"]["id"]
    client.put(
        f"/api/meal-plans/{meal_plan_id}/slots/{dinner_id}",
        json={"title": "Pasta", "ingredients_json": ["Pasta", "Tomatoes", "pasta"]},
    )

    response = client.post(f"/api/meal-plans/{meal_plan_id}/generate-shopping-list")

    assert response.status_code == 200
    payload = response.json()
    assert payload["shopping_list"]["name"] == "Meal plan: Dinner plan"
    assert [item["title"] for item in payload["items"]] == ["Pasta", "Tomatoes"]
    assert {item["module_key"] for item in payload["items"]} == {"shopping_list"}

    planned_items = db_session.query(PlannedItem).filter(PlannedItem.user_id == user.id).all()
    assert {item.title for item in planned_items} == {"Pasta", "Tomatoes"}


# ── Service ─────────────────────────────────────────────────────────────────


def test_generate_shopping_list_rejects_empty_ingredients(db_session: Session) -> None:
    user = _create_user(db_session, "empty-meal-shopping@example.com")
    service = MealPlanService(MealPlanRepository(db_session))
    plan = service.create_meal_plan(user.id, MealPlanCreate(name="Empty", week_start=date(2026, 6, 8)))

    with pytest.raises(Exception) as exc_info:
        service.generate_shopping_list(plan.id, user.id)

    assert getattr(exc_info.value, "status_code", None) == 422
