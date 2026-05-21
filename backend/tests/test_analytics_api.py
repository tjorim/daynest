from datetime import date, datetime, time, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.enums import ChoreStatus, MedicationDoseStatus
from app.main import app
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
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


def _add_chore(
    db_session: Session,
    user: User,
    template: ChoreTemplate,
    scheduled_date: date,
    status: ChoreStatus,
) -> None:
    db_session.add(
        ChoreInstance(
            user_id=user.id,
            chore_template_id=template.id,
            title=template.name,
            scheduled_date=scheduled_date,
            status=status,
            completed_at=datetime.now(timezone.utc) if status == ChoreStatus.completed else None,
            skipped_at=datetime.now(timezone.utc) if status == ChoreStatus.skipped else None,
        )
    )


def _add_medication_dose(
    db_session: Session,
    user: User,
    plan: MedicationPlan,
    scheduled_date: date,
    status: MedicationDoseStatus,
) -> None:
    scheduled_at = datetime.combine(scheduled_date, plan.schedule_time, tzinfo=timezone.utc)
    db_session.add(
        MedicationDoseInstance(
            user_id=user.id,
            medication_plan_id=plan.id,
            name=plan.name,
            instructions=plan.instructions,
            scheduled_date=scheduled_date,
            scheduled_at=scheduled_at,
            status=status,
            taken_at=datetime.now(timezone.utc) if status == MedicationDoseStatus.taken else None,
            skipped_at=datetime.now(timezone.utc) if status == MedicationDoseStatus.skipped else None,
            missed_at=datetime.now(timezone.utc) if status == MedicationDoseStatus.missed else None,
        )
    )


def test_analytics_summary_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/analytics/summary")
    assert response.status_code == 401


def test_analytics_summary_rejects_unknown_period(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="analytics-period@example.com")
    _auth_as(user)
    try:
        response = client.get("/api/v1/analytics/summary?period=quarter")
    finally:
        _clear_auth()

    assert response.status_code == 422


def test_analytics_summary_aggregates_user_history(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="analytics@example.com")
    other_user = _create_user(db_session, email="analytics-other@example.com")
    today = date.today()

    chore_template = ChoreTemplate(
        user_id=user.id,
        name="Laundry",
        description=None,
        start_date=today,
        every_n_days=1,
        is_active=True,
    )
    other_chore_template = ChoreTemplate(
        user_id=other_user.id,
        name="Other laundry",
        description=None,
        start_date=today,
        every_n_days=1,
        is_active=True,
    )
    medication_plan = MedicationPlan(
        user_id=user.id,
        name="Vitamin D",
        instructions="Take with breakfast",
        start_date=today,
        schedule_time=time(9, 0),
        every_n_days=1,
        is_active=True,
    )
    db_session.add_all([chore_template, other_chore_template, medication_plan])
    db_session.commit()
    db_session.refresh(chore_template)
    db_session.refresh(other_chore_template)
    db_session.refresh(medication_plan)

    _add_chore(db_session, user, chore_template, today, ChoreStatus.completed)
    _add_chore(db_session, user, chore_template, today - timedelta(days=1), ChoreStatus.skipped)
    _add_chore(db_session, user, chore_template, today - timedelta(days=4), ChoreStatus.completed)
    _add_chore(db_session, user, chore_template, today - timedelta(days=5), ChoreStatus.completed)
    _add_chore(db_session, other_user, other_chore_template, today, ChoreStatus.completed)

    _add_medication_dose(db_session, user, medication_plan, today, MedicationDoseStatus.skipped)
    _add_medication_dose(db_session, user, medication_plan, today - timedelta(days=1), MedicationDoseStatus.taken)
    _add_medication_dose(db_session, user, medication_plan, today - timedelta(days=2), MedicationDoseStatus.missed)

    db_session.add_all(
        [
            PlannedItem(user_id=user.id, title="Meal prep", planned_for=today, is_done=True),
            PlannedItem(
                user_id=user.id,
                title="Review bills",
                planned_for=today - timedelta(days=1),
                is_done=False,
            ),
            PlannedItem(
                user_id=user.id,
                title="Outside window",
                planned_for=today - timedelta(days=8),
                is_done=True,
            ),
            PlannedItem(user_id=other_user.id, title="Other plan", planned_for=today, is_done=True),
        ]
    )
    db_session.commit()

    _auth_as(user)
    try:
        response = client.get("/api/v1/analytics/summary?period=week")
    finally:
        _clear_auth()

    assert response.status_code == 200
    payload = response.json()
    assert payload["period"] == "week"
    assert payload["start_date"] == (today - timedelta(days=6)).isoformat()
    assert payload["end_date"] == today.isoformat()

    chores = payload["chores"]
    assert chores["completion_rate"] == 0.75
    assert chores["total_completed"] == 3
    assert chores["total_scheduled"] == 4
    assert chores["streaks"] == [
        {"chore_id": chore_template.id, "name": "Laundry", "current_streak": 1, "longest_streak": 2}
    ]
    assert chores["most_skipped"] == [{"chore_id": chore_template.id, "name": "Laundry", "skip_count": 1}]
    assert len(chores["daily_completions"]) == 7
    assert chores["daily_completions"][-1] == {
        "date": today.isoformat(),
        "completed": 1,
        "total": 1,
        "completion_rate": 1.0,
    }

    medications = payload["medications"]
    assert medications["adherence_rate"] == 0.3333
    assert medications["total_taken"] == 1
    assert medications["total_scheduled"] == 3

    planned_items = payload["planned_items"]
    assert planned_items["completion_rate"] == 0.5
    assert planned_items["total_completed"] == 1
    assert planned_items["total_scheduled"] == 2


def test_analytics_streaks_use_bounded_recent_history(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="analytics-streak-window@example.com")
    today = date.today()

    chore_template = ChoreTemplate(
        user_id=user.id,
        name="Dishes",
        description=None,
        start_date=today - timedelta(days=140),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(chore_template)
    db_session.commit()
    db_session.refresh(chore_template)

    for offset in range(130, 120, -1):
        _add_chore(db_session, user, chore_template, today - timedelta(days=offset), ChoreStatus.completed)
    _add_chore(db_session, user, chore_template, today - timedelta(days=2), ChoreStatus.completed)
    _add_chore(db_session, user, chore_template, today - timedelta(days=1), ChoreStatus.completed)
    _add_chore(db_session, user, chore_template, today, ChoreStatus.completed)
    db_session.commit()

    _auth_as(user)
    try:
        response = client.get("/api/v1/analytics/summary?period=week")
    finally:
        _clear_auth()

    assert response.status_code == 200
    assert response.json()["chores"]["streaks"] == [
        {"chore_id": chore_template.id, "name": "Dishes", "current_streak": 3, "longest_streak": 3}
    ]
