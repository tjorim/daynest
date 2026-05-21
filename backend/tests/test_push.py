from datetime import date, datetime, time, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.main import app
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.medication_plan import MedicationPlan
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.services.push_service import dispatch_medication_reminders, dispatch_overdue_chores


def _create_user(db_session: Session, email: str) -> User:
    user = User(email=email, full_name="Test User", is_active=True, timezone="UTC")
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


def test_push_subscribe_and_unsubscribe(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "push-subscribe@example.com")
    _auth_as(user)
    try:
        subscribe = client.post(
            "/api/v1/push/subscribe",
            json={
                "platform": "webpush",
                "endpoint": "https://push.example/subscription-1",
                "p256dh": "key",
                "auth": "auth",
            },
        )
        assert subscribe.status_code == 204

        subscription = db_session.query(PushSubscription).filter(PushSubscription.user_id == user.id).one()
        assert subscription.is_active is True

        unsubscribe = client.request(
            "DELETE",
            "/api/v1/push/subscribe",
            json={"endpoint": "https://push.example/subscription-1"},
        )
        assert unsubscribe.status_code == 204
    finally:
        _clear_auth()

    db_session.refresh(subscription)
    assert subscription.is_active is False


def test_dispatch_functions_and_quiet_hours(client: TestClient, db_session: Session, monkeypatch) -> None:
    user = _create_user(db_session, "push-dispatch@example.com")
    chore_template = ChoreTemplate(
        user_id=user.id,
        name="Laundry",
        description=None,
        start_date=date(2026, 5, 1),
        every_n_days=1,
        is_active=True,
    )
    med_plan = MedicationPlan(
        user_id=user.id,
        name="Vitamin D",
        instructions="Take with water",
        start_date=date(2026, 5, 1),
        schedule_time=time(10, 10),
        every_n_days=1,
        is_active=True,
    )
    db_session.add_all([chore_template, med_plan])
    db_session.commit()

    subscription = PushSubscription(
        user_id=user.id,
        platform="fcm",
        endpoint="fcm-token",
        is_active=True,
    )
    overdue = ChoreInstance(
        user_id=user.id,
        chore_template_id=chore_template.id,
        title="Laundry",
        scheduled_date=date(2026, 5, 20),
        status="pending",
    )
    reminder = MedicationDoseInstance(
        user_id=user.id,
        medication_plan_id=med_plan.id,
        name="Vitamin D",
        instructions="Take with water",
        scheduled_date=date(2026, 5, 21),
        scheduled_at=datetime(2026, 5, 21, 10, 10, tzinfo=timezone.utc),
        status="scheduled",
    )
    db_session.add_all([subscription, overdue, reminder])
    db_session.commit()

    sent: list[dict] = []

    def _fake_send(subscription: PushSubscription, title: str, body: str, data: dict) -> None:
        sent.append({"endpoint": subscription.endpoint, "title": title, "body": body, "data": data})

    monkeypatch.setattr("app.services.push_service.send_notification", _fake_send)

    now = datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc)
    assert dispatch_overdue_chores(db_session, user.id, now=now) == 1
    assert dispatch_medication_reminders(db_session, user.id, now=now) == 1
    assert len(sent) == 2

    user.quiet_hours_start = time(0, 0)
    user.quiet_hours_end = time(23, 59)
    db_session.commit()
    sent.clear()

    assert dispatch_overdue_chores(db_session, user.id, now=now + timedelta(minutes=1)) == 0
    assert sent == []
