from datetime import date, datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.tokens import create_access_token
from app.models.routine_template import RoutineTemplate
from app.models.task_instance import TaskInstance, TaskStatus
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


def test_get_today_authenticated_schema_is_stable(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="today@example.com")

    routine = RoutineTemplate(user_id=user.id, name="Morning", description=None, is_active=True)
    db_session.add(routine)
    db_session.commit()
    db_session.refresh(routine)

    today = date.today()
    task = TaskInstance(
        user_id=user.id,
        routine_template_id=routine.id,
        title="Take vitamins",
        scheduled_date=today,
        due_at=datetime(2026, 4, 23, 8, 0, tzinfo=timezone.utc),
        status=TaskStatus.pending,
    )
    db_session.add(task)
    db_session.commit()

    token = create_access_token(user_id=user.id, email=user.email)
    response = client.get("/api/v1/today", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200

    payload = response.json()
    assert list(payload.keys()) == ["medication", "routines", "overdue", "due_today", "upcoming", "planned"]

    assert payload["medication"] == []
    assert payload["overdue"] == []
    assert payload["upcoming"] == []
    assert payload["planned"] == []

    assert len(payload["routines"]) == 1
    assert len(payload["due_today"]) == 1

    assert list(payload["routines"][0].keys()) == [
        "task_instance_id",
        "routine_template_id",
        "title",
        "status",
        "scheduled_date",
        "due_at",
    ]
    assert list(payload["due_today"][0].keys()) == [
        "task_instance_id",
        "title",
        "status",
        "scheduled_date",
        "due_at",
    ]


def test_get_today_empty_state_is_deterministic(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="empty@example.com")
    token = create_access_token(user_id=user.id, email=user.email)
    headers = {"Authorization": f"Bearer {token}"}

    first_response = client.get("/api/v1/today", headers=headers)
    second_response = client.get("/api/v1/today", headers=headers)

    assert first_response.status_code == 200
    assert second_response.status_code == 200

    expected_payload = {
        "medication": [],
        "routines": [],
        "overdue": [],
        "due_today": [],
        "upcoming": [],
        "planned": [],
    }

    assert first_response.json() == expected_payload
    assert second_response.json() == expected_payload
