from datetime import date, datetime, time, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.enums import ChoreStatus, MedicationDoseStatus, Priority, TaskStatus
from app.main import app
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
from app.models.routine_template import RoutineTemplate
from app.models.task_instance import TaskInstance
from app.models.user import User


def _create_user(db_session: Session, email: str) -> User:
    user = User(email=email, full_name="Export User", is_active=True)
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


def _seed_export_data(db_session: Session, user: User) -> None:
    user.timezone = "Europe/Brussels"
    user.default_snooze_days = 2
    user.medication_reminder_minutes = 45
    user.quiet_hours_start = time(22, 0)
    user.quiet_hours_end = time(7, 0)
    user.push_overdue_chores_enabled = False
    user.push_medication_reminders_enabled = False

    routine = RoutineTemplate(
        user_id=user.id,
        name="Morning reset",
        description="Tidy kitchen",
        start_date=date(2026, 5, 1),
        every_n_days=1,
        rrule="FREQ=WEEKLY;BYDAY=MO",
        due_time=time(8, 0),
        is_active=True,
    )
    chore = ChoreTemplate(
        user_id=user.id,
        name="Laundry",
        description="Wash towels",
        start_date=date(2026, 5, 2),
        every_n_days=7,
        rrule=None,
        priority=Priority.high,
        tags=["home", "weekly"],
        is_active=True,
    )
    medication = MedicationPlan(
        user_id=user.id,
        name="Vitamin D",
        instructions="Take with breakfast",
        start_date=date(2026, 5, 1),
        schedule_time=time(9, 30),
        every_n_days=1,
        is_active=True,
    )
    db_session.add_all([routine, chore, medication])
    db_session.commit()
    db_session.refresh(routine)
    db_session.refresh(chore)
    db_session.refresh(medication)

    db_session.add_all(
        [
            TaskInstance(
                user_id=user.id,
                routine_template_id=routine.id,
                title=routine.name,
                scheduled_date=date(2026, 5, 4),
                due_at=datetime(2026, 5, 4, 8, 0, tzinfo=timezone.utc),
                status=TaskStatus.completed,
                completed_at=datetime(2026, 5, 4, 8, 10, tzinfo=timezone.utc),
            ),
            ChoreInstance(
                user_id=user.id,
                chore_template_id=chore.id,
                title=chore.name,
                scheduled_date=date(2026, 5, 2),
                status=ChoreStatus.skipped,
                skipped_at=datetime(2026, 5, 2, 11, 0, tzinfo=timezone.utc),
            ),
            MedicationDoseInstance(
                user_id=user.id,
                medication_plan_id=medication.id,
                name=medication.name,
                instructions=medication.instructions,
                scheduled_date=date(2026, 5, 1),
                scheduled_at=datetime(2026, 5, 1, 9, 30, tzinfo=timezone.utc),
                status=MedicationDoseStatus.taken,
                taken_at=datetime(2026, 5, 1, 9, 35, tzinfo=timezone.utc),
            ),
            PlannedItem(
                user_id=user.id,
                title="Meal prep",
                notes="Sunday batch",
                module_key="meal_planning",
                recurrence_hint="weekly",
                linked_source="manual",
                linked_ref="prep-1",
                planned_for=date(2026, 5, 3),
                priority=Priority.urgent,
                tags=["food"],
                is_done=True,
                completed_at=datetime(2026, 5, 3, 16, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    db_session.commit()


def test_export_user_data_returns_full_json_backup(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "export@example.com")
    _seed_export_data(db_session, user)
    _auth_as(user)

    try:
        response = client.get("/api/v1/users/me/export")
    finally:
        _clear_auth()

    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == 1
    assert payload["user_settings"]["timezone"] == "Europe/Brussels"
    assert payload["user_settings"]["quiet_hours_start"] == "22:00:00"
    assert payload["user_settings"]["push_overdue_chores_enabled"] is False
    assert payload["routine_templates"][0]["name"] == "Morning reset"
    assert payload["chore_templates"][0]["priority"] == "high"
    assert payload["chore_templates"][0]["tags"] == ["home", "weekly"]
    assert payload["medication_plans"][0]["name"] == "Vitamin D"
    assert payload["task_instances"][0]["status"] == "completed"
    assert payload["chore_instances"][0]["status"] == "skipped"
    assert payload["medication_dose_instances"][0]["status"] == "taken"
    assert payload["planned_items"][0]["priority"] == "urgent"


def test_export_user_data_can_return_csv(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "export-csv@example.com")
    _seed_export_data(db_session, user)
    _auth_as(user)

    try:
        response = client.get("/api/v1/users/me/export?format=csv")
    finally:
        _clear_auth()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "table" in response.text
    assert "user_settings" in response.text
    assert "chore_templates" in response.text
    assert "Laundry" in response.text


def test_import_user_data_restores_export_for_current_user(client: TestClient, db_session: Session) -> None:
    source = _create_user(db_session, "source@example.com")
    target = _create_user(db_session, "target@example.com")
    _seed_export_data(db_session, source)

    _auth_as(source)
    try:
        payload = client.get("/api/v1/users/me/export").json()
    finally:
        _clear_auth()

    _auth_as(target)
    try:
        response = client.post("/api/v1/users/me/import", json=payload)
    finally:
        _clear_auth()

    assert response.status_code == 200
    assert response.json()["imported"] == {
        "routine_templates": 1,
        "chore_templates": 1,
        "medication_plans": 1,
        "task_instances": 1,
        "chore_instances": 1,
        "medication_dose_instances": 1,
        "planned_items": 1,
    }

    db_session.refresh(target)
    assert target.timezone == "Europe/Brussels"
    assert target.default_snooze_days == 2
    assert target.push_overdue_chores_enabled is False
    assert target.push_medication_reminders_enabled is False
    imported_routine = db_session.query(RoutineTemplate).filter_by(user_id=target.id).one()
    imported_task = db_session.query(TaskInstance).filter_by(user_id=target.id).one()
    imported_chore = db_session.query(ChoreTemplate).filter_by(user_id=target.id).one()
    imported_chore_instance = db_session.query(ChoreInstance).filter_by(user_id=target.id).one()
    imported_plan = db_session.query(MedicationPlan).filter_by(user_id=target.id).one()
    imported_dose = db_session.query(MedicationDoseInstance).filter_by(user_id=target.id).one()
    imported_planned = db_session.query(PlannedItem).filter_by(user_id=target.id).one()

    assert imported_task.routine_template_id == imported_routine.id
    assert imported_chore_instance.chore_template_id == imported_chore.id
    assert imported_dose.medication_plan_id == imported_plan.id
    assert imported_planned.title == "Meal prep"
    assert imported_planned.tags == ["food"]


def test_export_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/users/me/export")
    assert response.status_code == 401
