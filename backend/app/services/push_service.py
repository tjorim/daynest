import logging
import json
from datetime import datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from pywebpush import WebPushException, webpush
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import ChoreStatus, MedicationDoseStatus, PushPlatform
from app.models.chore_instance import ChoreInstance
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.push_subscription import PushSubscription
from app.models.user import User

logger = logging.getLogger(__name__)


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


def send_notification(subscription: PushSubscription, title: str, body: str, data: dict[str, Any]) -> None:
    try:
        if subscription.platform == PushPlatform.fcm:
            if not settings.fcm_server_key:
                return
            with httpx.Client(timeout=10.0) as client:
                client.post(
                    "https://fcm.googleapis.com/fcm/send",
                    headers={
                        "Authorization": f"key={settings.fcm_server_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "to": subscription.endpoint,
                        "notification": {"title": title, "body": body},
                        "data": data,
                    },
                )
            return

        if subscription.platform == PushPlatform.webpush:
            if not settings.vapid_private_key or not settings.vapid_claims_email:
                return
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
    except (httpx.HTTPError, WebPushException):
        logger.exception("Failed to send push notification")


def _active_subscriptions(db: Session, user_id: int) -> list[PushSubscription]:
    return list(
        db.scalars(
            select(PushSubscription).where(PushSubscription.user_id == user_id).where(PushSubscription.is_active.is_(True))
        ).all()
    )


def dispatch_overdue_chores(db: Session, user_id: int, *, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    user = db.scalar(select(User).where(User.id == user_id).where(User.is_active.is_(True)))
    if user is None or not _user_can_receive_push(now, user):
        return 0
    overdue_count = db.scalar(
        select(func.count())
        .select_from(ChoreInstance)
        .where(ChoreInstance.user_id == user_id)
        .where(ChoreInstance.status == ChoreStatus.pending)
        .where(ChoreInstance.scheduled_date < now.date())
    ) or 0
    if not overdue_count:
        return 0
    sent = 0
    for subscription in _active_subscriptions(db, user_id):
        send_notification(
            subscription,
            "Overdue chores",
            f"You have {overdue_count} overdue chores",
            {"type": "overdue_chores", "count": overdue_count},
        )
        sent += 1
    return sent


def dispatch_medication_reminders(db: Session, user_id: int, *, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    user = db.scalar(select(User).where(User.id == user_id).where(User.is_active.is_(True)))
    if user is None or not _user_can_receive_push(now, user):
        return 0
    window_end = now + timedelta(minutes=user.medication_reminder_minutes)
    dose_count = db.scalar(
        select(func.count())
        .select_from(MedicationDoseInstance)
        .where(MedicationDoseInstance.user_id == user_id)
        .where(MedicationDoseInstance.status == MedicationDoseStatus.scheduled)
        .where(MedicationDoseInstance.scheduled_at >= now)
        .where(MedicationDoseInstance.scheduled_at <= window_end)
    ) or 0
    if not dose_count:
        return 0
    sent = 0
    for subscription in _active_subscriptions(db, user_id):
        send_notification(
            subscription,
            "Medication reminder",
            f"You have {dose_count} medication doses coming up",
            {"type": "medication_reminder", "count": dose_count},
        )
        sent += 1
    return sent


def dispatch_missed_medications(db: Session, user_id: int, *, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    user = db.scalar(select(User).where(User.id == user_id).where(User.is_active.is_(True)))
    if user is None or not _user_can_receive_push(now, user):
        return 0
    missed_count = db.scalar(
        select(func.count())
        .select_from(MedicationDoseInstance)
        .where(MedicationDoseInstance.user_id == user_id)
        .where(MedicationDoseInstance.status == MedicationDoseStatus.missed)
        .where(MedicationDoseInstance.scheduled_at <= now)
    ) or 0
    if not missed_count:
        return 0
    sent = 0
    for subscription in _active_subscriptions(db, user_id):
        send_notification(
            subscription,
            "Missed medication",
            f"You have {missed_count} missed medication doses",
            {"type": "missed_medication", "count": missed_count},
        )
        sent += 1
    return sent
