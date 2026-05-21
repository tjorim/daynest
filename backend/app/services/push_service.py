import json
import logging
from datetime import datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import ChoreStatus, MedicationDoseStatus, PushPlatform
from app.models.chore_instance import ChoreInstance
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.notification_sent import NotificationSent
from app.models.push_subscription import PushSubscription
from app.models.user import User

logger = logging.getLogger(__name__)
_FCM_SCOPES = ("https://www.googleapis.com/auth/firebase.messaging",)
_http_client = httpx.Client(timeout=10.0)


def close_http_client() -> None:
    _http_client.close()


def _is_quiet_time(now_time: time, quiet_start: time | None, quiet_end: time | None) -> bool:
    if quiet_start is None or quiet_end is None:
        return False
    if quiet_start == quiet_end:
        return True
    if quiet_start < quiet_end:
        return quiet_start <= now_time < quiet_end
    return now_time >= quiet_start or now_time < quiet_end


def _user_can_receive_push(now: datetime, user: User) -> bool:
    try:
        tz = ZoneInfo(user.timezone)
    except ZoneInfoNotFoundError:
        tz = timezone.utc
    local_time = now.astimezone(tz).time()
    return not _is_quiet_time(local_time, user.quiet_hours_start, user.quiet_hours_end)


def _fcm_access_token() -> str | None:
    if not settings.fcm_service_account_file:
        return None
    credentials = service_account.Credentials.from_service_account_file(
        settings.fcm_service_account_file,
        scopes=_FCM_SCOPES,
    )
    credentials.refresh(Request())
    return credentials.token


def _stringify_fcm_data(data: dict[str, Any]) -> dict[str, str]:
    return {key: str(value) for key, value in data.items()}


def send_notification(subscription: PushSubscription, title: str, body: str, data: dict[str, Any]) -> bool:
    try:
        if subscription.platform == PushPlatform.fcm:
            access_token = _fcm_access_token()
            if not settings.fcm_project_id or not access_token:
                return False
            response = _http_client.post(
                f"https://fcm.googleapis.com/v1/projects/{settings.fcm_project_id}/messages:send",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "message": {
                        "token": subscription.endpoint,
                        "notification": {"title": title, "body": body},
                        "data": _stringify_fcm_data(data),
                    },
                },
            )
            response.raise_for_status()
            return True

        if subscription.platform == PushPlatform.webpush:
            if not settings.vapid_private_key or not settings.vapid_claims_email:
                return False
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {
                        "p256dh": subscription.p256dh or "",
                        "auth": subscription.auth or "",
                    },
                },
                data=json.dumps({"title": title, "body": body, "data": data}),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": f"mailto:{settings.vapid_claims_email}"},
            )
            return True
    except (GoogleAuthError, OSError, ValueError, httpx.HTTPError, WebPushException):
        logger.exception(
            "Failed to send push notification for subscription_id=%s user_id=%s platform=%s",
            subscription.id,
            subscription.user_id,
            subscription.platform,
        )
    return False


def _active_subscriptions(db: Session, user_id: int) -> list[PushSubscription]:
    return list(
        db.scalars(
            select(PushSubscription).where(PushSubscription.user_id == user_id).where(PushSubscription.is_active.is_(True))
        ).all()
    )


def _unnotified_item_ids(db: Session, user_id: int, notification_type: str, item_ids: list[int]) -> list[int]:
    if not item_ids:
        return []
    notified_ids = set(
        db.scalars(
            select(NotificationSent.item_id)
            .where(NotificationSent.user_id == user_id)
            .where(NotificationSent.notification_type == notification_type)
            .where(NotificationSent.item_id.in_(item_ids))
        ).all()
    )
    return [item_id for item_id in item_ids if item_id not in notified_ids]


def _record_notifications(db: Session, user_id: int, notification_type: str, item_ids: list[int]) -> None:
    db.add_all(
        NotificationSent(user_id=user_id, notification_type=notification_type, item_id=item_id)
        for item_id in item_ids
    )
    db.commit()


def _active_subscription_exists(user_id_column):
    return (
        select(PushSubscription.id)
        .where(PushSubscription.user_id == user_id_column)
        .where(PushSubscription.is_active.is_(True))
        .exists()
    )


def _notification_sent_exists(user_id_column, notification_type: str, item_id_column):
    return (
        select(NotificationSent.id)
        .where(NotificationSent.user_id == user_id_column)
        .where(NotificationSent.notification_type == notification_type)
        .where(NotificationSent.item_id == item_id_column)
        .exists()
    )


def pending_push_user_ids(db: Session, *, now: datetime | None = None) -> list[int]:
    now = now or datetime.now(timezone.utc)
    pending_user_ids: set[int] = set()

    pending_user_ids.update(
        db.scalars(
            select(ChoreInstance.user_id)
            .join(User, User.id == ChoreInstance.user_id)
            .where(User.is_active.is_(True))
            .where(User.push_overdue_chores_enabled.is_(True))
            .where(ChoreInstance.status == ChoreStatus.pending)
            .where(ChoreInstance.scheduled_date < now.date())
            .where(_active_subscription_exists(ChoreInstance.user_id))
            .where(~_notification_sent_exists(ChoreInstance.user_id, "overdue_chores", ChoreInstance.id))
            .distinct()
        ).all()
    )
    pending_user_ids.update(
        db.scalars(
            select(MedicationDoseInstance.user_id)
            .join(User, User.id == MedicationDoseInstance.user_id)
            .where(User.is_active.is_(True))
            .where(User.push_medication_reminders_enabled.is_(True))
            .where(MedicationDoseInstance.status == MedicationDoseStatus.scheduled)
            .where(MedicationDoseInstance.scheduled_at >= now)
            .where(MedicationDoseInstance.scheduled_at <= now + timedelta(days=1))
            .where(_active_subscription_exists(MedicationDoseInstance.user_id))
            .where(~_notification_sent_exists(MedicationDoseInstance.user_id, "medication_reminder", MedicationDoseInstance.id))
            .distinct()
        ).all()
    )
    pending_user_ids.update(
        db.scalars(
            select(MedicationDoseInstance.user_id)
            .join(User, User.id == MedicationDoseInstance.user_id)
            .where(User.is_active.is_(True))
            .where(User.push_missed_medications_enabled.is_(True))
            .where(MedicationDoseInstance.status == MedicationDoseStatus.missed)
            .where(MedicationDoseInstance.scheduled_at <= now)
            .where(_active_subscription_exists(MedicationDoseInstance.user_id))
            .where(~_notification_sent_exists(MedicationDoseInstance.user_id, "missed_medication", MedicationDoseInstance.id))
            .distinct()
        ).all()
    )
    return sorted(pending_user_ids)


def dispatch_overdue_chores(db: Session, user_id: int, *, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    user = db.scalar(select(User).where(User.id == user_id).where(User.is_active.is_(True)))
    if user is None or not user.push_overdue_chores_enabled or not _user_can_receive_push(now, user):
        return 0
    overdue_ids = list(
        db.scalars(
            select(ChoreInstance.id)
            .where(ChoreInstance.user_id == user_id)
            .where(ChoreInstance.status == ChoreStatus.pending)
            .where(ChoreInstance.scheduled_date < now.date())
        ).all()
    )
    overdue_ids = _unnotified_item_ids(db, user_id, "overdue_chores", overdue_ids)
    if not overdue_ids:
        return 0
    sent = 0
    for subscription in _active_subscriptions(db, user_id):
        if send_notification(
            subscription,
            "Overdue chores",
            f"You have {len(overdue_ids)} overdue chores",
            {"type": "overdue_chores", "count": len(overdue_ids)},
        ):
            sent += 1
    if sent:
        _record_notifications(db, user_id, "overdue_chores", overdue_ids)
    return sent


def dispatch_medication_reminders(db: Session, user_id: int, *, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    user = db.scalar(select(User).where(User.id == user_id).where(User.is_active.is_(True)))
    if user is None or not user.push_medication_reminders_enabled or not _user_can_receive_push(now, user):
        return 0
    window_end = now + timedelta(minutes=user.medication_reminder_minutes)
    dose_ids = list(
        db.scalars(
            select(MedicationDoseInstance.id)
            .where(MedicationDoseInstance.user_id == user_id)
            .where(MedicationDoseInstance.status == MedicationDoseStatus.scheduled)
            .where(MedicationDoseInstance.scheduled_at >= now)
            .where(MedicationDoseInstance.scheduled_at <= window_end)
        ).all()
    )
    dose_ids = _unnotified_item_ids(db, user_id, "medication_reminder", dose_ids)
    if not dose_ids:
        return 0
    sent = 0
    for subscription in _active_subscriptions(db, user_id):
        if send_notification(
            subscription,
            "Medication reminder",
            f"You have {len(dose_ids)} medication doses coming up",
            {"type": "medication_reminder", "count": len(dose_ids)},
        ):
            sent += 1
    if sent:
        _record_notifications(db, user_id, "medication_reminder", dose_ids)
    return sent


def dispatch_missed_medications(db: Session, user_id: int, *, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    user = db.scalar(select(User).where(User.id == user_id).where(User.is_active.is_(True)))
    if user is None or not user.push_missed_medications_enabled or not _user_can_receive_push(now, user):
        return 0
    missed_ids = list(
        db.scalars(
            select(MedicationDoseInstance.id)
            .where(MedicationDoseInstance.user_id == user_id)
            .where(MedicationDoseInstance.status == MedicationDoseStatus.missed)
            .where(MedicationDoseInstance.scheduled_at <= now)
        ).all()
    )
    missed_ids = _unnotified_item_ids(db, user_id, "missed_medication", missed_ids)
    if not missed_ids:
        return 0
    sent = 0
    for subscription in _active_subscriptions(db, user_id):
        if send_notification(
            subscription,
            "Missed medication",
            f"You have {len(missed_ids)} missed medication doses",
            {"type": "missed_medication", "count": len(missed_ids)},
        ):
            sent += 1
    if sent:
        _record_notifications(db, user_id, "missed_medication", missed_ids)
    return sent
