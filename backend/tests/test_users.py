"""Tests for user account settings and deletion endpoints."""

from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.main import app
from app.models.chore_template import ChoreTemplate
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.medication_plan import MedicationPlan
from app.models.user import User


def _create_user(db_session: Session, email: str) -> User:
    user = User(email=email, full_name="Test User", is_active=True)
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


def test_delete_current_user_removes_personal_data(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "delete-me@example.com")
    plan = MedicationPlan(user_id=user.id, name="Vitamin D", instructions="Take daily", start_date=date.today(), schedule_time=time(8, 0))
    db_session.add(plan)
    db_session.commit()
    _auth_as(user)

    response = client.delete("/api/users/me")

    assert response.status_code == 204
    assert db_session.get(User, user.id) is None
    assert db_session.get(MedicationPlan, plan.id) is None


def test_delete_current_user_blocks_household_shared_chores(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "shared-owner@example.com")
    member = _create_user(db_session, "shared-member@example.com")
    household = Household(name="Shared home")
    db_session.add(household)
    db_session.flush()
    db_session.add_all([
        HouseholdMember(household_id=household.id, user_id=owner.id, role="owner"),
        HouseholdMember(household_id=household.id, user_id=member.id, role="member"),
    ])
    db_session.add(
        ChoreTemplate(
            user_id=owner.id,
            household_id=household.id,
            name="Shared dishes",
            start_date=date.today(),
            every_n_days=1,
        )
    )
    db_session.commit()
    _auth_as(owner)

    response = client.delete("/api/users/me")

    assert response.status_code == 409
    assert "household-shared chores" in response.json()["detail"]
    assert db_session.get(User, owner.id) is not None
