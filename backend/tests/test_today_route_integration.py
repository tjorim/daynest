from datetime import date, datetime, time, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.today import get_today_service
from app.api.routes import calendar as calendar_routes
from app.core.config import settings
from app.core.enums import ChoreStatus, MedicationDoseStatus, TaskStatus
from app.main import app
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
from app.models.routine_template import RoutineTemplate
from app.models.task_instance import TaskInstance
from app.models.user import User
from app.repositories.today_repository import TodayRepository
from app.schemas.integrations import HACalendarEvent
from app.schemas.today import TodayResponse
from app.services.today_service import TodayService


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


def test_get_today_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/today")
    assert response.status_code == 401


def test_get_today_includes_generated_chore_sections(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="today@example.com")
    _auth_as(user)

    routine_template = RoutineTemplate(
        user_id=user.id,
        name="Morning reset",
        description="Kitchen and windows",
        start_date=date.today(),
        every_n_days=1,
        due_time=time(8, 0),
        is_active=True,
    )
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
    db_session.add(routine_template)
    db_session.add(template)
    db_session.add(med_plan)
    db_session.commit()

    try:
        response = client.get("/api/v1/today")
    finally:
        _clear_auth()

    assert response.status_code == 200
    payload = response.json()

    required_keys = {"medication", "medication_history", "routines", "overdue", "due_today", "upcoming", "planned", "day_items"}
    assert set(payload.keys()) == required_keys
    assert payload["due_today"][0]["title"] == "Take out trash"
    assert payload["due_today"][0]["status"] == "pending"
    assert payload["medication"][0]["name"] == "Vitamin D"
    assert payload["medication"][0]["instructions"] == "Take with breakfast and water"
    assert payload["routines"][0]["title"] == "Morning reset"
    assert payload["routines"][0]["status"] == "pending"


def test_chore_generation_falls_back_for_invalid_rrule(db_session: Session) -> None:
    user = _create_user(db_session, email="invalid-rrule@example.com")
    template = ChoreTemplate(
        user_id=user.id,
        name="Fallback chore",
        description=None,
        start_date=date(2026, 4, 20),
        every_n_days=2,
        rrule="NOT_A_VALID_RRULE",
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    repository = TodayRepository(db_session)
    repository.ensure_chore_instances_generated(user_id=user.id, through_date=date(2026, 4, 25))

    generated_dates = [
        item.scheduled_date
        for item in db_session.query(ChoreInstance)
        .filter(ChoreInstance.chore_template_id == template.id)
        .order_by(ChoreInstance.scheduled_date)
        .all()
    ]
    assert generated_dates == [date(2026, 4, 20), date(2026, 4, 22), date(2026, 4, 24)]


def test_chore_generation_does_not_fallback_for_exhausted_rrule(db_session: Session) -> None:
    user = _create_user(db_session, email="exhausted-rrule@example.com")
    template = ChoreTemplate(
        user_id=user.id,
        name="One-time chore",
        description=None,
        start_date=date(2026, 4, 20),
        every_n_days=1,
        rrule="FREQ=DAILY;COUNT=1",
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    repository = TodayRepository(db_session)
    repository.ensure_chore_instances_generated(user_id=user.id, through_date=date(2026, 4, 25))
    repository.ensure_chore_instances_generated(user_id=user.id, through_date=date(2026, 4, 30))

    generated_dates = [
        item.scheduled_date
        for item in db_session.query(ChoreInstance)
        .filter(ChoreInstance.chore_template_id == template.id)
        .order_by(ChoreInstance.scheduled_date)
        .all()
    ]
    assert generated_dates == [date(2026, 4, 20)]


def test_routine_generation_falls_back_for_invalid_rrule(db_session: Session) -> None:
    user = _create_user(db_session, email="invalid-routine-rrule@example.com")
    template = RoutineTemplate(
        user_id=user.id,
        name="Fallback routine",
        description=None,
        start_date=date(2026, 4, 20),
        every_n_days=2,
        rrule="NOT_A_VALID_RRULE",
        due_time=time(7, 30),
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    repository = TodayRepository(db_session)
    repository.ensure_task_instances_generated(user_id=user.id, through_date=date(2026, 4, 25))

    generated = (
        db_session.query(TaskInstance)
        .filter(TaskInstance.routine_template_id == template.id)
        .order_by(TaskInstance.scheduled_date)
        .all()
    )
    assert [item.scheduled_date for item in generated] == [date(2026, 4, 20), date(2026, 4, 22), date(2026, 4, 24)]
    assert [item.due_at for item in generated] == [
        datetime(2026, 4, 20, 7, 30),
        datetime(2026, 4, 22, 7, 30),
        datetime(2026, 4, 24, 7, 30),
    ]


def test_routine_generation_does_not_fallback_for_exhausted_rrule(db_session: Session) -> None:
    user = _create_user(db_session, email="exhausted-routine-rrule@example.com")
    template = RoutineTemplate(
        user_id=user.id,
        name="One-time routine",
        description=None,
        start_date=date(2026, 4, 20),
        every_n_days=1,
        rrule="FREQ=DAILY;COUNT=1",
        due_time=time(8, 0),
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    repository = TodayRepository(db_session)
    repository.ensure_task_instances_generated(user_id=user.id, through_date=date(2026, 4, 25))
    repository.ensure_task_instances_generated(user_id=user.id, through_date=date(2026, 4, 30))

    generated = (
        db_session.query(TaskInstance)
        .filter(TaskInstance.routine_template_id == template.id)
        .order_by(TaskInstance.scheduled_date)
        .all()
    )
    assert [item.scheduled_date for item in generated] == [date(2026, 4, 20)]
    assert generated[0].due_at == datetime(2026, 4, 20, 8, 0)


def test_get_today_allows_today_service_dependency_override(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="today-override@example.com")
    _auth_as(user)

    class StubTodayService(TodayService):
        def __init__(self) -> None:
            super().__init__(MagicMock(spec=TodayRepository), app_settings=settings)

        def get_today(self, *, user_id: int, for_date: date) -> TodayResponse:
            assert user_id == user.id
            assert for_date == date.today()
            return TodayResponse(
                medication=[],
                medication_history=[],
                routines=[],
                overdue=[],
                due_today=[],
                upcoming=[],
                planned=[],
                day_items=[],
            )

    app.dependency_overrides[get_today_service] = lambda: StubTodayService()
    try:
        response = client.get("/api/v1/today")
    finally:
        app.dependency_overrides.pop(get_today_service, None)
        _clear_auth()

    assert response.status_code == 200
    assert response.json() == {
        "medication": [],
        "medication_history": [],
        "routines": [],
        "overdue": [],
        "due_today": [],
        "upcoming": [],
        "planned": [],
        "day_items": [],
    }


def test_chore_mutation_endpoints_complete_skip_and_reschedule(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="mutate@example.com")
    _auth_as(user)

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
    pending_instance = ChoreInstance(
        user_id=user.id,
        chore_template_id=template.id,
        title=template.name,
        scheduled_date=date(2026, 4, 24),
        status=ChoreStatus.pending,
    )
    db_session.add(instance)
    db_session.add(pending_instance)
    db_session.commit()
    db_session.refresh(instance)
    db_session.refresh(pending_instance)

    try:
        complete_resp = client.post(f"/api/v1/chores/{instance.id}/complete")
        assert complete_resp.status_code == 200
        assert complete_resp.json()["status"] == "completed"
        assert complete_resp.json()["completed_at"] is not None
        assert complete_resp.json()["skipped_at"] is None

        skip_resp = client.post(f"/api/v1/chores/{instance.id}/skip")
        assert skip_resp.status_code == 200
        assert skip_resp.json()["status"] == "skipped"
        assert skip_resp.json()["skipped_at"] is not None
        assert skip_resp.json()["completed_at"] is None

        blocked = client.post(f"/api/v1/chores/{instance.id}/reschedule", json={"scheduled_date": "2026-04-25"})
        assert blocked.status_code == 409

        reschedule = client.post(f"/api/v1/chores/{pending_instance.id}/reschedule", json={"scheduled_date": "2026-04-25"})
        assert reschedule.status_code == 200
        assert reschedule.json()["status"] == "pending"
        assert reschedule.json()["scheduled_date"] == "2026-04-25"
    finally:
        _clear_auth()


def test_medication_endpoints_create_list_history_and_mutate_status(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="meds@example.com")
    _auth_as(user)

    try:
        create_resp = client.post(
            "/api/v1/medications",
            json={
                "name": "Magnesium",
                "instructions": "Take after dinner",
                "start_date": "2026-04-20",
                "schedule_time": "20:00:00",
                "every_n_days": 1,
            },
        )
        assert create_resp.status_code == 200
        assert create_resp.json()["name"] == "Magnesium"

        list_resp = client.get("/api/v1/medications")
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 1

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

        take_resp = client.post(f"/api/v1/medication-doses/{dose.id}/take")
        assert take_resp.status_code == 200
        assert take_resp.json()["status"] == "taken"

        history_resp = client.get("/api/v1/medication-doses/history")
        assert history_resp.status_code == 200
        assert history_resp.json()["history"][0]["name"] == "Magnesium"
    finally:
        _clear_auth()


def test_calendar_and_planned_endpoints(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="calendar@example.com")
    _auth_as(user)

    try:
        create_planned = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Meal prep",
                "planned_for": "2026-04-24",
                "time_of_day": "10:00",
                "duration_minutes": 90,
                "notes": "Sunday batch",
                "module_key": "meal_planning",
                "linked_source": "google_calendar",
                "linked_ref": "meal-prep-2026-04-24",
            },
        )
        assert create_planned.status_code == 200
        assert create_planned.json()["module_key"] == "meal_planning"
        assert create_planned.json()["time_of_day"] == "10:00:00"
        assert create_planned.json()["duration_minutes"] == 90
        assert create_planned.json()["linked_source"] == "google_calendar"
        assert create_planned.json()["linked_ref"] == "meal-prep-2026-04-24"
        planned_id = create_planned.json()["id"]

        list_planned = client.get("/api/v1/planned-items?start_date=2026-04-24&end_date=2026-04-24")
        assert list_planned.status_code == 200
        assert len(list_planned.json()) == 1

        update_planned = client.put(
            f"/api/v1/planned-items/{planned_id}",
            json={
                "title": "Meal prep",
                "planned_for": "2026-04-24",
                "time_of_day": "11:30",
                "duration_minutes": 45,
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
        assert update_planned.json()["time_of_day"] == "11:30:00"
        assert update_planned.json()["duration_minutes"] == 45
        assert update_planned.json()["recurrence_hint"] == "weekly"
        assert update_planned.json()["linked_source"] == "google_calendar"
        assert update_planned.json()["linked_ref"] == "meal-prep-2026-04-24"

        day_resp = client.get("/api/v1/calendar/day?date=2026-04-24")
        assert day_resp.status_code == 200
        assert day_resp.json()["items"][0]["item_type"] == "planned"

        month_resp = client.get("/api/v1/calendar/month?year=2026&month=4")
        assert month_resp.status_code == 200
        assert month_resp.json()["days"][0]["planned"] >= 1

        delete_resp = client.delete(f"/api/v1/planned-items/{planned_id}")
        assert delete_resp.status_code == 204
    finally:
        _clear_auth()


def test_ical_timed_events_are_formatted_as_utc() -> None:
    event_lines = calendar_routes._format_event(
        uid="event-1",
        dtstamp="20260420T000000Z",
        summary="Offset event",
        start={"dateTime": "2026-04-20T09:00:00+02:00"},
        end={"dateTime": "2026-04-20T10:00:00+02:00"},
        description=None,
        reminder_minutes=None,
    )

    assert "DTSTART:20260420T070000Z" in event_lines
    assert "DTEND:20260420T080000Z" in event_lines


def test_ical_export_window_uses_user_timezone(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    user = _create_user(db_session, email="ical-window@example.com")
    user.calendar_token = "calendar-token"
    user.timezone = "Pacific/Kiritimati"
    db_session.commit()

    captured: dict[str, date] = {}

    class StubCalendarService:
        def get_calendar_events(self, user_id: int, start_date: date, end_date: date) -> list[HACalendarEvent]:
            assert user_id == user.id
            captured["start_date"] = start_date
            captured["end_date"] = end_date
            return []

    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            value = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
            return value.astimezone(tz) if tz else value.replace(tzinfo=None)

    app.dependency_overrides[get_today_service] = lambda: StubCalendarService()
    monkeypatch.setattr(calendar_routes, "datetime", FixedDatetime)
    try:
        response = client.get("/api/v1/calendar/export.ics?token=calendar-token")
    finally:
        app.dependency_overrides.pop(get_today_service, None)

    assert response.status_code == 200
    assert captured["start_date"] == date(2025, 11, 3)
    assert captured["end_date"] == date(2027, 1, 2)


def test_bulk_mutations_commit_once_for_successful_items(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    user = _create_user(db_session, email="bulk@example.com")
    _auth_as(user)

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

    complete_instance = ChoreInstance(
        user_id=user.id,
        chore_template_id=template.id,
        title=template.name,
        scheduled_date=date(2026, 4, 23),
        status=ChoreStatus.pending,
    )
    skip_instance = ChoreInstance(
        user_id=user.id,
        chore_template_id=template.id,
        title=template.name,
        scheduled_date=date(2026, 4, 24),
        status=ChoreStatus.pending,
    )
    planned_item = PlannedItem(
        user_id=user.id,
        title="Meal prep",
        planned_for=date(2026, 4, 25),
        is_done=False,
    )
    db_session.add_all([complete_instance, skip_instance, planned_item])
    db_session.commit()
    db_session.refresh(complete_instance)
    db_session.refresh(skip_instance)
    db_session.refresh(planned_item)

    commit_count = 0
    original_commit = db_session.commit

    def counted_commit() -> None:
        nonlocal commit_count
        commit_count += 1
        original_commit()

    monkeypatch.setattr(db_session, "commit", counted_commit)

    try:
        response = client.post(
            "/api/v1/bulk",
            json={
                "mutations": [
                    {"type": "complete_chore", "id": complete_instance.id},
                    {"type": "skip_chore", "id": skip_instance.id},
                    {"type": "mark_planned_done", "id": planned_item.id},
                    {"type": "complete_chore", "id": 999999},
                ]
            },
        )
    finally:
        _clear_auth()

    assert response.status_code == 200
    assert [item["success"] for item in response.json()["results"]] == [True, True, True, False]
    assert commit_count == 1

    db_session.refresh(complete_instance)
    db_session.refresh(skip_instance)
    db_session.refresh(planned_item)
    assert complete_instance.status == ChoreStatus.completed
    assert skip_instance.status == ChoreStatus.skipped
    assert planned_item.is_done is True


def test_medication_plan_update_and_delete(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="med-crud@example.com")
    _auth_as(user)

    try:
        create_resp = client.post(
            "/api/v1/medications",
            json={
                "name": "Zinc",
                "instructions": "Take with food",
                "start_date": "2026-05-01",
                "schedule_time": "20:00:00",
                "every_n_days": 1,
            },
        )
        assert create_resp.status_code == 200
        plan_id = create_resp.json()["id"]

        update_resp = client.put(
            f"/api/v1/medications/{plan_id}",
            json={
                "name": "Zinc supplement",
                "instructions": "Take with dinner",
                "start_date": "2026-05-01",
                "schedule_time": "21:00:00",
                "every_n_days": 2,
                "is_active": False,
            },
        )
        assert update_resp.status_code == 200
        body = update_resp.json()
        assert body["name"] == "Zinc supplement"
        assert body["every_n_days"] == 2
        assert body["is_active"] is False

        not_found_update = client.put(
            "/api/v1/medications/9999",
            json={
                "name": "Ghost",
                "instructions": "N/A",
                "start_date": "2026-05-01",
                "schedule_time": "09:00:00",
                "every_n_days": 1,
                "is_active": True,
            },
        )
        assert not_found_update.status_code == 404

        delete_resp = client.delete(f"/api/v1/medications/{plan_id}")
        assert delete_resp.status_code == 204

        list_resp = client.get("/api/v1/medications")
        assert list_resp.status_code == 200
        assert list_resp.json() == []

        not_found_delete = client.delete("/api/v1/medications/9999")
        assert not_found_delete.status_code == 404
    finally:
        _clear_auth()


def test_template_management_endpoints(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="templates@example.com")
    _auth_as(user)

    try:
        create_routine = client.post(
            "/api/v1/templates/routines",
            json={
                "name": "Morning reset",
                "description": "Open windows and tidy the kitchen",
                "start_date": "2026-04-24",
                "every_n_days": 1,
                "due_time": "08:00:00",
                "is_active": True,
            },
        )
        assert create_routine.status_code == 201
        routine_id = create_routine.json()["id"]

        list_routines = client.get("/api/v1/templates/routines")
        assert list_routines.status_code == 200
        assert len(list_routines.json()) == 1

        update_routine = client.put(
            f"/api/v1/templates/routines/{routine_id}",
            json={
                "name": "Morning reset",
                "description": "Open windows and clear counters",
                "start_date": "2026-04-24",
                "every_n_days": 2,
                "due_time": "08:30:00",
                "is_active": False,
            },
        )
        assert update_routine.status_code == 200
        assert update_routine.json()["is_active"] is False
        assert update_routine.json()["every_n_days"] == 2

        create_chore = client.post(
            "/api/v1/templates/chores",
            json={
                "name": "Laundry",
                "description": "Wash towels",
                "start_date": "2026-04-24",
                "every_n_days": 7,
                "tags": ["home"],
                "is_active": True,
            },
        )
        assert create_chore.status_code == 201
        chore_id = create_chore.json()["id"]

        list_chores = client.get("/api/v1/templates/chores")
        assert list_chores.status_code == 200
        assert len(list_chores.json()) == 1

        list_chores_by_tag = client.get("/api/v1/templates/chores?tags=home,%20,%20")
        assert list_chores_by_tag.status_code == 200
        assert [item["id"] for item in list_chores_by_tag.json()] == [chore_id]

        update_chore = client.put(
            f"/api/v1/templates/chores/{chore_id}",
            json={
                "name": "Laundry",
                "description": "Wash towels and bedding",
                "start_date": "2026-04-24",
                "every_n_days": 14,
                "tags": ["home"],
                "is_active": True,
            },
        )
        assert update_chore.status_code == 200
        assert update_chore.json()["every_n_days"] == 14

        delete_routine = client.delete(f"/api/v1/templates/routines/{routine_id}")
        assert delete_routine.status_code == 204

        delete_chore = client.delete(f"/api/v1/templates/chores/{chore_id}")
        assert delete_chore.status_code == 204
    finally:
        _clear_auth()


def test_routine_task_generation_and_mutation_endpoints(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="routine-tasks@example.com")
    _auth_as(user)

    routine_template = RoutineTemplate(
        user_id=user.id,
        name="Morning check",
        description="Review day plan",
        start_date=date.today(),
        every_n_days=1,
        due_time=time(7, 30),
        is_active=True,
    )
    db_session.add(routine_template)
    db_session.commit()

    try:
        today_resp = client.get("/api/v1/today")
        assert today_resp.status_code == 200
        task_id = today_resp.json()["routines"][0]["task_instance_id"]

        start_resp = client.post(f"/api/v1/tasks/{task_id}/start")
        assert start_resp.status_code == 200
        assert start_resp.json()["status"] == "in_progress"

        complete_resp = client.post(f"/api/v1/tasks/{task_id}/complete")
        assert complete_resp.status_code == 200
        assert complete_resp.json()["status"] == "completed"
        assert complete_resp.json()["completed_at"] is not None

        skipped_instance = TaskInstance(
            user_id=user.id,
            routine_template_id=routine_template.id,
            title=routine_template.name,
            scheduled_date=date.fromordinal(date.today().toordinal() + 1),
            due_at=datetime.combine(
                date.fromordinal(date.today().toordinal() + 1),
                time(7, 30),
                tzinfo=timezone.utc,
            ),
            status=TaskStatus.pending,
        )
        db_session.add(skipped_instance)
        db_session.commit()
        db_session.refresh(skipped_instance)

        skip_resp = client.post(f"/api/v1/tasks/{skipped_instance.id}/skip")
        assert skip_resp.status_code == 200
        assert skip_resp.json()["status"] == "skipped"
    finally:
        _clear_auth()
