from datetime import date, datetime, time, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.main import app
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.medication_plan import MedicationPlan
from app.models.notification_sent import NotificationSent
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.services.push_service import dispatch_medication_reminders, dispatch_overdue_chores, pending_push_user_ids
from app.services.push_service import send_notification


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
            "/api/push/subscribe",
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
            "/api/push/subscribe",
            json={"endpoint": "https://push.example/subscription-1"},
        )
        assert unsubscribe.status_code == 204
    finally:
        _clear_auth()

    db_session.refresh(subscription)
    assert subscription.is_active is False


def test_send_notification_uses_fcm_http_v1(monkeypatch) -> None:
    posted: dict = {}

    class _Response:
        def raise_for_status(self) -> None:
            return None

    class _Client:
        def post(self, url: str, *, headers: dict, json: dict) -> _Response:
            posted.update({"url": url, "headers": headers, "json": json})
            return _Response()

    monkeypatch.setattr("app.services.push_service._fcm_access_token", lambda: "access-token")
    monkeypatch.setattr("app.services.push_service.settings.fcm_project_id", "daynest-fcm")
    monkeypatch.setattr("app.services.push_service._http_client", _Client())

    subscription = PushSubscription(user_id=1, platform="fcm", endpoint="fcm-device-token", is_active=True)
    assert send_notification(subscription, "Reminder", "Take medicine", {"type": "medication_reminder", "count": 2})
    assert posted == {
        "url": "https://fcm.googleapis.com/v1/projects/daynest-fcm/messages:send",
        "headers": {
            "Authorization": "Bearer access-token",
            "Content-Type": "application/json",
        },
        "json": {
            "message": {
                "token": "fcm-device-token",
                "notification": {"title": "Reminder", "body": "Take medicine"},
                "data": {"type": "medication_reminder", "count": "2"},
            }
        },
    }


def test_user_settings_store_push_notification_preferences(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "push-settings@example.com")
    _auth_as(user)
    try:
        response = client.patch(
            "/api/users/me/settings",
            json={
                "push_overdue_chores_enabled": False,
                "push_medication_reminders_enabled": False,
                "push_missed_medications_enabled": True,
            },
        )
    finally:
        _clear_auth()

    assert response.status_code == 200
    assert response.json() == {
        "timezone": "UTC",
        "default_snooze_days": 1,
        "medication_reminder_minutes": 30,
        "quiet_hours_start": None,
        "quiet_hours_end": None,
        "push_overdue_chores_enabled": False,
        "push_medication_reminders_enabled": False,
        "push_missed_medications_enabled": True,
    }
    db_session.refresh(user)
    assert user.push_overdue_chores_enabled is False
    assert user.push_medication_reminders_enabled is False


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

    def _fake_send(subscription: PushSubscription, title: str, body: str, data: dict) -> bool:
        sent.append({"endpoint": subscription.endpoint, "title": title, "body": body, "data": data})
        return True

    monkeypatch.setattr("app.services.push_service.send_notification", _fake_send)

    now = datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc)
    assert dispatch_overdue_chores(db_session, user.id, now=now) == 1
    assert dispatch_medication_reminders(db_session, user.id, now=now) == 1
    assert len(sent) == 2
    assert dispatch_overdue_chores(db_session, user.id, now=now) == 0
    assert dispatch_medication_reminders(db_session, user.id, now=now) == 0

    user.quiet_hours_start = time(0, 0)
    user.quiet_hours_end = time(23, 59)
    db_session.commit()
    sent.clear()

    assert dispatch_overdue_chores(db_session, user.id, now=now + timedelta(minutes=1)) == 0
    assert dispatch_medication_reminders(db_session, user.id, now=now + timedelta(minutes=1)) == 0
    assert sent == []


def test_dispatch_overdue_chores_respects_user_preference(db_session: Session, monkeypatch) -> None:
    user = _create_user(db_session, "push-overdue-disabled@example.com")
    user.push_overdue_chores_enabled = False
    chore_template = ChoreTemplate(
        user_id=user.id,
        name="Bins",
        description=None,
        start_date=date(2026, 5, 1),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(chore_template)
    db_session.commit()
    db_session.add_all(
        [
            PushSubscription(user_id=user.id, platform="fcm", endpoint="disabled-fcm-token", is_active=True),
            ChoreInstance(
                user_id=user.id,
                chore_template_id=chore_template.id,
                title="Bins",
                scheduled_date=date(2026, 5, 20),
                status="pending",
            ),
        ]
    )
    db_session.commit()

    sent: list[dict] = []
    monkeypatch.setattr("app.services.push_service.send_notification", lambda *args: sent.append({}) or True)

    assert dispatch_overdue_chores(
        db_session,
        user.id,
        now=datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc),
    ) == 0
    assert sent == []


def test_pending_push_user_ids_only_returns_users_with_unnotified_candidates(db_session: Session) -> None:
    candidate = _create_user(db_session, "push-candidate@example.com")
    notified = _create_user(db_session, "push-notified@example.com")
    idle = _create_user(db_session, "push-idle@example.com")
    templates = [
        ChoreTemplate(
            user_id=user.id,
            name=f"Candidate chore {user.id}",
            description=None,
            start_date=date(2026, 5, 1),
            every_n_days=1,
            is_active=True,
        )
        for user in (candidate, notified)
    ]
    db_session.add_all(templates)
    db_session.commit()

    candidate_chore = ChoreInstance(
        user_id=candidate.id,
        chore_template_id=templates[0].id,
        title="Needs notification",
        scheduled_date=date(2026, 5, 20),
        status="pending",
    )
    notified_chore = ChoreInstance(
        user_id=notified.id,
        chore_template_id=templates[1].id,
        title="Already notified",
        scheduled_date=date(2026, 5, 20),
        status="pending",
    )
    db_session.add_all(
        [
            PushSubscription(user_id=candidate.id, platform="fcm", endpoint="candidate-token", is_active=True),
            PushSubscription(user_id=notified.id, platform="fcm", endpoint="notified-token", is_active=True),
            PushSubscription(user_id=idle.id, platform="fcm", endpoint="idle-token", is_active=True),
            candidate_chore,
            notified_chore,
        ]
    )
    db_session.commit()
    db_session.add(
        NotificationSent(
            user_id=notified.id,
            notification_type="overdue_chores",
            item_id=notified_chore.id,
        )
    )
    db_session.commit()

    assert pending_push_user_ids(
        db_session,
        now=datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc),
    ) == [candidate.id]
