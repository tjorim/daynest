from datetime import date, datetime, time, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.tokens import create_access_token
from app.models.chore_instance import ChoreInstance, ChoreStatus
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance, MedicationDoseStatus
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
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
    med_plan = MedicationPlan(
        user_id=user.id,
        name="Vitamin D",
        instructions="Take with breakfast and water",
        start_date=date.today(),
        schedule_time=time(9, 0),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(template)
    db_session.add(med_plan)
    db_session.commit()

    token = create_access_token(user_id=user.id, email=user.email)
    response = client.get("/api/v1/today", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    payload = response.json()

    assert list(payload.keys()) == ["medication", "medication_history", "routines", "overdue", "due_today", "upcoming", "planned", "day_items"]
    assert payload["due_today"][0]["title"] == "Take out trash"
    assert payload["due_today"][0]["status"] == "pending"
    assert payload["medication"][0]["name"] == "Vitamin D"
    assert payload["medication"][0]["instructions"] == "Take with breakfast and water"


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


def test_medication_endpoints_create_list_history_and_mutate_status(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="meds@example.com")
    token = create_access_token(user_id=user.id, email=user.email)
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/v1/medications",
        headers=headers,
        json={
            "name": "Magnesium",
            "instructions": "Take after dinner",
            "start_date": "2026-04-20",
            "schedule_time": "20:00:00",
            "every_n_days": 1,
        },
    )
    assert create_response.status_code == 200
    assert create_response.json()["name"] == "Magnesium"

    list_response = client.get("/api/v1/medications", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    plan = db_session.query(MedicationPlan).filter(MedicationPlan.user_id == user.id).one()
    dose = MedicationDoseInstance(
        user_id=user.id,
        medication_plan_id=plan.id,
        name=plan.name,
        instructions=plan.instructions,
        scheduled_date=date(2026, 4, 22),
        scheduled_at=datetime(2026, 4, 22, 20, 0, tzinfo=timezone.utc),
        status=MedicationDoseStatus.scheduled,
    )
    db_session.add(dose)
    db_session.commit()
    db_session.refresh(dose)

    take_response = client.post(f"/api/v1/medication-doses/{dose.id}/take", headers=headers)
    assert take_response.status_code == 200
    assert take_response.json()["status"] == "taken"

    history_response = client.get("/api/v1/medication-doses/history", headers=headers)
    assert history_response.status_code == 200
    assert history_response.json()["history"][0]["name"] == "Magnesium"


def test_calendar_and_planned_endpoints(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="calendar@example.com")
    token = create_access_token(user_id=user.id, email=user.email)
    headers = {"Authorization": f"Bearer {token}"}

    create_planned = client.post(
        "/api/v1/planned-items",
        headers=headers,
        json={
            "title": "Meal prep",
            "planned_for": "2026-04-24",
            "notes": "Sunday batch",
            "module_key": "meal_planning",
            "linked_source": "google_calendar",
            "linked_ref": "meal-prep-2026-04-24",
        },
    )
    assert create_planned.status_code == 200
    assert create_planned.json()["module_key"] == "meal_planning"
    assert create_planned.json()["linked_source"] == "google_calendar"
    assert create_planned.json()["linked_ref"] == "meal-prep-2026-04-24"
    planned_id = create_planned.json()["id"]

    list_planned = client.get("/api/v1/planned-items?start_date=2026-04-24&end_date=2026-04-24", headers=headers)
    assert list_planned.status_code == 200
    assert len(list_planned.json()) == 1

    update_planned = client.put(
        f"/api/v1/planned-items/{planned_id}",
        headers=headers,
        json={
            "title": "Meal prep",
            "planned_for": "2026-04-24",
            "notes": "Sunday batch",
            "module_key": "meal_planning",
            "recurrence_hint": "weekly",
            "linked_source": "google_calendar",
            "linked_ref": "meal-prep-2026-04-24",
            "is_done": True,
        },
    )
    assert update_planned.status_code == 200
    assert update_planned.json()["is_done"] is True
    assert update_planned.json()["recurrence_hint"] == "weekly"
    assert update_planned.json()["linked_source"] == "google_calendar"
    assert update_planned.json()["linked_ref"] == "meal-prep-2026-04-24"

    day_response = client.get("/api/v1/calendar/day?date=2026-04-24", headers=headers)
    assert day_response.status_code == 200
    assert day_response.json()["items"][0]["item_type"] == "planned"

    month_response = client.get("/api/v1/calendar/month?year=2026&month=4", headers=headers)
    assert month_response.status_code == 200
    assert month_response.json()["days"][0]["planned"] >= 1

    delete_response = client.delete(f"/api/v1/planned-items/{planned_id}", headers=headers)
    assert delete_response.status_code == 204
