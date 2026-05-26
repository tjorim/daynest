"""Tests for household/shared mode API endpoints."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.main import app
from app.models.chore_instance import ChoreInstance
from app.models.user import User
from app.core.enums import HouseholdMemberRole


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


# ── Household CRUD ──────────────────────────────────────────────────────────


def test_create_household_requires_auth(client: TestClient) -> None:
    response = client.post("/api/v1/households", json={"name": "Smith Family"})
    assert response.status_code == 401


def test_create_household(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner@example.com")
    _auth_as(owner)

    response = client.post("/api/v1/households", json={"name": "Smith Family"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Smith Family"
    assert len(data["members"]) == 1
    assert data["members"][0]["user_id"] == owner.id
    assert data["members"][0]["role"] == HouseholdMemberRole.owner.value


def test_list_households_empty(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "user@example.com")
    _auth_as(user)

    response = client.get("/api/v1/households")
    assert response.status_code == 200
    assert response.json() == []


def test_list_households_returns_users_households(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner2@example.com")
    _auth_as(owner)

    client.post("/api/v1/households", json={"name": "Family A"})
    client.post("/api/v1/households", json={"name": "Family B"})

    response = client.get("/api/v1/households")
    assert response.status_code == 200
    names = [h["name"] for h in response.json()]
    assert "Family A" in names
    assert "Family B" in names


def test_get_household(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner3@example.com")
    _auth_as(owner)

    created = client.post("/api/v1/households", json={"name": "My Home"}).json()
    household_id = created["id"]

    response = client.get(f"/api/v1/households/{household_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "My Home"


def test_get_household_forbidden_for_non_member(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner4@example.com")
    other = _create_user(db_session, "other@example.com")

    _auth_as(owner)
    created = client.post("/api/v1/households", json={"name": "Private"}).json()
    household_id = created["id"]

    _auth_as(other)
    response = client.get(f"/api/v1/households/{household_id}")
    assert response.status_code == 403


def test_update_household_name(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner5@example.com")
    _auth_as(owner)

    created = client.post("/api/v1/households", json={"name": "Old Name"}).json()
    household_id = created["id"]

    response = client.put(f"/api/v1/households/{household_id}", json={"name": "New Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_update_household_forbidden_for_member(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner6@example.com")
    member = _create_user(db_session, "member6@example.com")

    _auth_as(owner)
    created = client.post("/api/v1/households", json={"name": "House"}).json()
    household_id = created["id"]
    client.post(f"/api/v1/households/{household_id}/invite", json={"email": member.email})

    _auth_as(member)
    response = client.put(f"/api/v1/households/{household_id}", json={"name": "Changed"})
    assert response.status_code == 403


def test_delete_household(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner7@example.com")
    _auth_as(owner)

    created = client.post("/api/v1/households", json={"name": "To Delete"}).json()
    household_id = created["id"]

    response = client.delete(f"/api/v1/households/{household_id}")
    assert response.status_code == 204

    response = client.get(f"/api/v1/households/{household_id}")
    assert response.status_code == 404


# ── Invite / membership ──────────────────────────────────────────────────────


def test_invite_member(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner8@example.com")
    invitee = _create_user(db_session, "invitee@example.com")
    _auth_as(owner)

    created = client.post("/api/v1/households", json={"name": "Shared Home"}).json()
    household_id = created["id"]

    response = client.post(f"/api/v1/households/{household_id}/invite", json={"email": invitee.email})
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == invitee.id
    assert data["role"] == HouseholdMemberRole.member.value


def test_invite_nonexistent_user_returns_404(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner9@example.com")
    _auth_as(owner)

    created = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created["id"]

    response = client.post(f"/api/v1/households/{household_id}/invite", json={"email": "ghost@example.com"})
    assert response.status_code == 404


def test_invite_duplicate_returns_409(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner10@example.com")
    invitee = _create_user(db_session, "invitee2@example.com")
    _auth_as(owner)

    created = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created["id"]

    client.post(f"/api/v1/households/{household_id}/invite", json={"email": invitee.email})
    response = client.post(f"/api/v1/households/{household_id}/invite", json={"email": invitee.email})
    assert response.status_code == 409


def test_remove_member(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner11@example.com")
    member = _create_user(db_session, "member11@example.com")
    _auth_as(owner)

    created = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created["id"]
    client.post(f"/api/v1/households/{household_id}/invite", json={"email": member.email})

    response = client.delete(f"/api/v1/households/{household_id}/members/{member.id}")
    assert response.status_code == 204


def test_remove_last_owner_returns_409(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner12@example.com")
    _auth_as(owner)

    created = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created["id"]

    response = client.delete(f"/api/v1/households/{household_id}/members/{owner.id}")
    assert response.status_code == 409


def test_member_cannot_remove_other_member(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner13@example.com")
    member1 = _create_user(db_session, "member13a@example.com")
    member2 = _create_user(db_session, "member13b@example.com")
    _auth_as(owner)

    created = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created["id"]
    client.post(f"/api/v1/households/{household_id}/invite", json={"email": member1.email})
    client.post(f"/api/v1/households/{household_id}/invite", json={"email": member2.email})

    _auth_as(member1)
    response = client.delete(f"/api/v1/households/{household_id}/members/{member2.id}")
    assert response.status_code == 403


# ── Household chore templates ────────────────────────────────────────────────


def test_create_household_chore_template(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner14@example.com")
    _auth_as(owner)

    created_household = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created_household["id"]

    response = client.post(
        "/api/v1/templates/chores",
        json={
            "name": "Vacuum Living Room",
            "start_date": str(date.today()),
            "every_n_days": 7,
            "household_id": household_id,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["household_id"] == household_id


def test_create_household_chore_template_non_member_forbidden(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner15@example.com")
    non_member = _create_user(db_session, "nonmember15@example.com")

    _auth_as(owner)
    created_household = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created_household["id"]

    _auth_as(non_member)
    response = client.post(
        "/api/v1/templates/chores",
        json={
            "name": "Vacuum",
            "start_date": str(date.today()),
            "every_n_days": 7,
            "household_id": household_id,
        },
    )
    assert response.status_code == 403


def test_member_can_see_household_chore_templates(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner16@example.com")
    member = _create_user(db_session, "member16@example.com")

    _auth_as(owner)
    created_household = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created_household["id"]
    client.post(f"/api/v1/households/{household_id}/invite", json={"email": member.email})

    # Owner creates a household chore
    client.post(
        "/api/v1/templates/chores",
        json={
            "name": "Shared Chore",
            "start_date": str(date.today()),
            "every_n_days": 1,
            "household_id": household_id,
        },
    )

    # Member should see it
    _auth_as(member)
    response = client.get("/api/v1/templates/chores")
    assert response.status_code == 200
    names = [t["name"] for t in response.json()]
    assert "Shared Chore" in names


def test_member_cannot_update_household_chore_template(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner19@example.com")
    member = _create_user(db_session, "member19@example.com")

    _auth_as(owner)
    created_household = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created_household["id"]
    client.post(f"/api/v1/households/{household_id}/invite", json={"email": member.email})
    created_template = client.post(
        "/api/v1/templates/chores",
        json={
            "name": "Shared Chore",
            "start_date": str(date.today()),
            "every_n_days": 1,
            "household_id": household_id,
        },
    ).json()

    _auth_as(member)
    response = client.put(
        f"/api/v1/templates/chores/{created_template['id']}",
        json={
            "name": "Renamed Chore",
            "start_date": str(date.today()),
            "every_n_days": 1,
            "household_id": household_id,
        },
    )

    assert response.status_code == 403


def test_member_cannot_delete_household_chore_template(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner20@example.com")
    member = _create_user(db_session, "member20@example.com")

    _auth_as(owner)
    created_household = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created_household["id"]
    client.post(f"/api/v1/households/{household_id}/invite", json={"email": member.email})
    created_template = client.post(
        "/api/v1/templates/chores",
        json={
            "name": "Shared Chore",
            "start_date": str(date.today()),
            "every_n_days": 1,
            "household_id": household_id,
        },
    ).json()

    _auth_as(member)
    response = client.delete(f"/api/v1/templates/chores/{created_template['id']}")

    assert response.status_code == 403


# ── Assign chore ─────────────────────────────────────────────────────────────


def test_assign_chore(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner17@example.com")
    member = _create_user(db_session, "member17@example.com")

    _auth_as(owner)
    created_household = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created_household["id"]
    client.post(f"/api/v1/households/{household_id}/invite", json={"email": member.email})

    # Create a household chore template and generate instances via today
    client.post(
        "/api/v1/templates/chores",
        json={
            "name": "Wash Dishes",
            "start_date": str(date.today()),
            "every_n_days": 1,
            "household_id": household_id,
        },
    )
    today_response = client.get("/api/v1/today").json()
    due_today = today_response["due_today"]
    assert len(due_today) > 0

    chore_instance_id = due_today[0]["chore_instance_id"]

    # Assign to member
    response = client.post(
        f"/api/v1/chores/{chore_instance_id}/assign",
        json={"assigned_to": member.id},
    )
    assert response.status_code == 200
    assert response.json()["assigned_to"] == member.id

    # Verify persisted state
    db_session.expire_all()
    instance = db_session.get(ChoreInstance, chore_instance_id)
    assert instance is not None
    assert instance.assigned_to == member.id


def test_assign_household_chore_rejects_non_member(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner21@example.com")
    non_member = _create_user(db_session, "nonmember21@example.com")

    _auth_as(owner)
    created_household = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created_household["id"]
    client.post(
        "/api/v1/templates/chores",
        json={
            "name": "Wash Dishes",
            "start_date": str(date.today()),
            "every_n_days": 1,
            "household_id": household_id,
        },
    )
    today_response = client.get("/api/v1/today").json()
    chore_instance_id = today_response["due_today"][0]["chore_instance_id"]

    response = client.post(
        f"/api/v1/chores/{chore_instance_id}/assign",
        json={"assigned_to": non_member.id},
    )

    assert response.status_code == 400


def test_assign_personal_chore_rejects_other_user(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner22@example.com")
    other = _create_user(db_session, "other22@example.com")

    _auth_as(owner)
    client.post(
        "/api/v1/templates/chores",
        json={
            "name": "Personal Chore",
            "start_date": str(date.today()),
            "every_n_days": 1,
        },
    )
    today_response = client.get("/api/v1/today").json()
    chore_instance_id = today_response["due_today"][0]["chore_instance_id"]

    response = client.post(
        f"/api/v1/chores/{chore_instance_id}/assign",
        json={"assigned_to": other.id},
    )

    assert response.status_code == 400


def test_complete_chore_sets_completed_by(client: TestClient, db_session: Session) -> None:
    owner = _create_user(db_session, "owner18@example.com")
    member = _create_user(db_session, "member18@example.com")

    _auth_as(owner)
    created_household = client.post("/api/v1/households", json={"name": "Home"}).json()
    household_id = created_household["id"]
    client.post(f"/api/v1/households/{household_id}/invite", json={"email": member.email})

    client.post(
        "/api/v1/templates/chores",
        json={
            "name": "Clean Kitchen",
            "start_date": str(date.today()),
            "every_n_days": 1,
            "household_id": household_id,
        },
    )
    today_response = client.get("/api/v1/today").json()
    chore_instance_id = today_response["due_today"][0]["chore_instance_id"]

    # Member completes it
    _auth_as(member)
    response = client.post(f"/api/v1/chores/{chore_instance_id}/complete")
    assert response.status_code == 200
    data = response.json()
    assert data["completed_by"] == member.id
