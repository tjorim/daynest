"""Tests for shopping-list backend APIs and service behavior."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.config import settings
from app.main import app
from app.models.planned_item import PlannedItem
from app.models.user import User
from app.repositories.shopping_list_repository import ShoppingListRepository
from app.repositories.today_repository import TodayRepository
from app.schemas.shopping_list import (
    ShoppingListCreateRequest,
    ShoppingListUpdateRequest,
)
from app.services.shopping_list_service import ShoppingListService
from app.services.today_service import TodayService


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


def _service(db_session: Session) -> ShoppingListService:
    return ShoppingListService(
        ShoppingListRepository(db_session),
        TodayService(TodayRepository(db_session), app_settings=settings),
    )


# ── Service ─────────────────────────────────────────────────────────────────


def test_shopping_list_service_crud_and_status_filter(db_session: Session) -> None:
    user = _create_user(db_session, "service-shopping@example.com")
    service = _service(db_session)

    created = service.create_shopping_list(
        user.id,
        ShoppingListCreateRequest(
            name="Groceries", store="Corner Market", notes="Use coupons"
        ),
    )
    assert created.name == "Groceries"
    assert created.status == "active"

    updated = service.update_shopping_list(
        user.id,
        created.id,
        ShoppingListUpdateRequest(
            name="Weekly groceries", store=None, status="archived"
        ),
    )
    assert updated.name == "Weekly groceries"
    assert updated.store is None
    assert service.list_shopping_lists(user.id) == []
    assert (
        service.list_shopping_lists(user.id, status_filter="archived")[0].id
        == created.id
    )


def test_delete_shopping_list_deletes_linked_planned_items(db_session: Session) -> None:
    user = _create_user(db_session, "delete-shopping@example.com")
    service = _service(db_session)
    shopping_list = service.create_shopping_list(
        user.id, ShoppingListCreateRequest(name="Hardware")
    )

    linked = PlannedItem(
        user_id=user.id,
        title="Screws",
        module_key="shopping_list",
        linked_ref=str(shopping_list.id),
        planned_for=date.today(),
        is_done=False,
    )
    db_session.add(linked)
    db_session.commit()

    service.delete_shopping_list(user.id, shopping_list.id)

    assert db_session.get(PlannedItem, linked.id) is None


# ── Routes ──────────────────────────────────────────────────────────────────


def test_create_list_and_filter_routes(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "route-shopping@example.com")
    _auth_as(user)

    response = client.post(
        "/api/shopping-lists", json={"name": "Groceries", "store": "Market"}
    )
    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Groceries"
    assert created["store"] == "Market"
    assert created["status"] == "active"

    response = client.get("/api/shopping-lists")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [created["id"]]

    response = client.put(
        f"/api/shopping-lists/{created['id']}", json={"status": "archived"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "archived"

    assert client.get("/api/shopping-lists").json() == []
    assert (
        client.get("/api/shopping-lists?status=archived").json()[0]["id"]
        == created["id"]
    )
    assert client.get("/api/shopping-lists?status=all").json()[0]["id"] == created["id"]


def test_shopping_lists_are_user_scoped(
    client: TestClient, db_session: Session
) -> None:
    owner = _create_user(db_session, "owner-shopping@example.com")
    other = _create_user(db_session, "other-shopping@example.com")
    _auth_as(owner)
    shopping_list_id = client.post(
        "/api/shopping-lists", json={"name": "Private"}
    ).json()["id"]

    _auth_as(other)
    assert client.get(f"/api/shopping-lists/{shopping_list_id}").status_code == 404
    assert (
        client.put(
            f"/api/shopping-lists/{shopping_list_id}", json={"name": "Nope"}
        ).status_code
        == 404
    )
    assert client.delete(f"/api/shopping-lists/{shopping_list_id}").status_code == 404


def test_delete_shopping_list_route(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "delete-route-shopping@example.com")
    _auth_as(user)
    shopping_list_id = client.post(
        "/api/shopping-lists", json={"name": "Delete me"}
    ).json()["id"]

    response = client.delete(f"/api/shopping-lists/{shopping_list_id}")
    assert response.status_code == 204
    assert client.get(f"/api/shopping-lists/{shopping_list_id}").status_code == 404


def test_import_recurring_groceries_route_links_upcoming_items(
    client: TestClient, db_session: Session
) -> None:
    from app.models.recurrence_series import RecurrenceSeries

    user = _create_user(db_session, "import-recurring-shopping@example.com")
    _auth_as(user)
    shopping_list_id = client.post(
        "/api/shopping-lists", json={"name": "Groceries"}
    ).json()["id"]

    db_session.add(
        RecurrenceSeries(
            user_id=user.id,
            title="Eggs",
            rrule="FREQ=WEEKLY;COUNT=2",
            start_date=date(2026, 6, 6),
            module_key="recurring_grocery",
            recurrence_hint="weekly",
        )
    )
    db_session.commit()

    response = client.post(f"/api/shopping-lists/{shopping_list_id}/import-recurring")

    assert response.status_code == 200
    payload = response.json()
    assert [item["planned_for"] for item in payload] == ["2026-06-06", "2026-06-13"]
    assert {item["module_key"] for item in payload} == {"shopping_list"}
    assert {item["linked_ref"] for item in payload} == {str(shopping_list_id)}

    repeat = client.post(f"/api/shopping-lists/{shopping_list_id}/import-recurring")
    assert repeat.status_code == 200
    assert [item["id"] for item in repeat.json()] == [item["id"] for item in payload]
