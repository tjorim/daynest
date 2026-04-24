from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.tokens import create_access_token
from app.models.chore_instance import ChoreInstance, ChoreStatus
from app.models.chore_template import ChoreTemplate
from app.models.user import User


def _create_user(db_session: Session, email: str) -> User:
    user = User(email=email, full_name="Test User", password_hash="hashed-password", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_get_today_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/today")
    assert response.status_code == 403


def test_get_today_includes_generated_chore_sections(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="today@example.com")

    template = ChoreTemplate(
        user_id=user.id,
        name="Take out trash",
        description=None,
        start_date=date.today(),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()

    token = create_access_token(user_id=user.id, email=user.email)
    response = client.get("/api/v1/today", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    payload = response.json()

    assert list(payload.keys()) == ["medication", "routines", "overdue", "due_today", "upcoming", "planned"]
    assert payload["due_today"][0]["title"] == "Take out trash"
    assert payload["due_today"][0]["status"] == "pending"


def test_chore_mutation_endpoints_complete_skip_and_reschedule(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="mutate@example.com")
    template = ChoreTemplate(
        user_id=user.id,
        name="Laundry",
        description=None,
        start_date=date(2026, 4, 23),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    instance = ChoreInstance(
        user_id=user.id,
        chore_template_id=template.id,
        title=template.name,
        scheduled_date=date(2026, 4, 23),
        status=ChoreStatus.pending,
    )
    db_session.add(instance)
    db_session.commit()
    db_session.refresh(instance)

    token = create_access_token(user_id=user.id, email=user.email)
    headers = {"Authorization": f"Bearer {token}"}

    complete_response = client.post(f"/api/v1/chores/{instance.id}/complete", headers=headers)
    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "completed"

    skip_response = client.post(f"/api/v1/chores/{instance.id}/skip", headers=headers)
    assert skip_response.status_code == 200
    assert skip_response.json()["status"] == "skipped"

    reschedule_response = client.post(
        f"/api/v1/chores/{instance.id}/reschedule",
        headers=headers,
        json={"scheduled_date": "2026-04-25"},
    )
    assert reschedule_response.status_code == 200
    payload = reschedule_response.json()
    assert payload["status"] == "pending"
    assert payload["scheduled_date"] == "2026-04-25"
