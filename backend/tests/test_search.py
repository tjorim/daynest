from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.enums import Priority
from app.main import app
from app.models.chore_template import ChoreTemplate
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
from app.models.routine_template import RoutineTemplate
from app.models.user import User


def _create_user(db: Session, email: str) -> User:
    user = User(email=email, full_name="Search User", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_as(user: User) -> None:
    async def _dep() -> User:
        return user

    app.dependency_overrides[get_current_user] = _dep


def _clear_auth() -> None:
    app.dependency_overrides.pop(get_current_user, None)


def _seed(db: Session, user: User) -> None:
    db.add_all(
        [
            RoutineTemplate(
                user_id=user.id,
                name="Morning stretches",
                description="Light yoga flow",
                start_date=date(2026, 1, 1),
                every_n_days=1,
                is_active=True,
            ),
            RoutineTemplate(
                user_id=user.id,
                name="Evening reading",
                description=None,
                start_date=date(2026, 1, 1),
                every_n_days=1,
                is_active=True,
            ),
            ChoreTemplate(
                user_id=user.id,
                name="Vacuum living room",
                description="Including under sofa",
                start_date=date(2026, 1, 1),
                every_n_days=7,
                priority=Priority.normal,
                tags=["home"],
                is_active=True,
            ),
            ChoreTemplate(
                user_id=user.id,
                name="Laundry",
                description=None,
                start_date=date(2026, 1, 1),
                every_n_days=7,
                priority=Priority.high,
                tags=[],
                is_active=True,
            ),
            MedicationPlan(
                user_id=user.id,
                name="Vitamin D",
                instructions="Take with breakfast",
                start_date=date(2026, 1, 1),
                schedule_time=time(9, 0),
                every_n_days=1,
                is_active=True,
            ),
            PlannedItem(
                user_id=user.id,
                title="Meal prep Sunday",
                notes="Batch cook rice and veggies",
                planned_for=date(2026, 5, 5),
                priority=Priority.normal,
                tags=[],
                is_done=False,
            ),
            PlannedItem(
                user_id=user.id,
                title="Buy groceries",
                notes=None,
                planned_for=date(2026, 5, 6),
                priority=Priority.normal,
                tags=[],
                is_done=False,
            ),
        ]
    )
    db.commit()


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    _clear_auth()


def test_search_returns_grouped_results(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "search1@example.com")
    _seed(db_session, user)
    _auth_as(user)

    response = client.get("/api/v1/search?q=vitamin")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "vitamin"
    assert len(data["medication_plans"]) == 1
    assert data["medication_plans"][0]["name"] == "Vitamin D"
    assert data["routine_templates"] == []
    assert data["chore_templates"] == []
    assert data["planned_items"] == []


def test_search_matches_description_field(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "search2@example.com")
    _seed(db_session, user)
    _auth_as(user)

    response = client.get("/api/v1/search?q=yoga")
    assert response.status_code == 200
    data = response.json()
    assert len(data["routine_templates"]) == 1
    assert data["routine_templates"][0]["name"] == "Morning stretches"


def test_search_is_case_insensitive(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "search3@example.com")
    _seed(db_session, user)
    _auth_as(user)

    response = client.get("/api/v1/search?q=MEAL")
    assert response.status_code == 200
    data = response.json()
    assert len(data["planned_items"]) == 1
    assert data["planned_items"][0]["title"] == "Meal prep Sunday"


def test_search_matches_planned_item_notes(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "search4@example.com")
    _seed(db_session, user)
    _auth_as(user)

    response = client.get("/api/v1/search?q=batch+cook")
    assert response.status_code == 200
    data = response.json()
    assert len(data["planned_items"]) == 1
    assert data["planned_items"][0]["title"] == "Meal prep Sunday"


def test_search_does_not_leak_other_users_data(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "search-owner@example.com")
    other = _create_user(db_session, "search-other@example.com")
    _seed(db_session, owner)
    _auth_as(other)

    response = client.get("/api/v1/search?q=vitamin")
    assert response.status_code == 200
    data = response.json()
    assert data["medication_plans"] == []


def test_search_rejects_query_shorter_than_two_chars(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "search5@example.com")
    _auth_as(user)

    response = client.get("/api/v1/search?q=a")
    assert response.status_code == 422


def test_search_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/search?q=vitamin")
    assert response.status_code == 401


def test_search_limit_caps_results(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "search6@example.com")
    for i in range(5):
        db_session.add(
            PlannedItem(
                user_id=user.id,
                title=f"Shopping item {i}",
                notes=None,
                planned_for=date(2026, 5, i + 1),
                priority=Priority.normal,
                tags=[],
                is_done=False,
            )
        )
    db_session.commit()
    _auth_as(user)

    response = client.get("/api/v1/search?q=shopping&limit=3")
    assert response.status_code == 200
    assert len(response.json()["planned_items"]) == 3
