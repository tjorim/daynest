"""Medication plan and dose-instance MCP tools."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime, time
from typing import Any

from sqlalchemy.orm import Session

from app.core.pagination import clamp_limit
from app.mcp.context import parse_date, with_today_service
from app.mcp.errors import map_domain_errors
from app.mcp.principal import McpPrincipal
from app.services.today_service import TodayService

SessionFactory = Callable[[], Session]

#: Medication history is date-bounded by nature (one row per scheduled dose);
#: 365 preserves the previous "up to a year" behavior while still being an
#: explicit, documented hard cap rather than an unbounded default.
DEFAULT_MEDICATION_HISTORY_LIMIT = 20
MAX_MEDICATION_HISTORY_LIMIT = 365


def _medication_plan_to_dict(plan: Any) -> dict[str, Any]:
    return {
        "id": plan.id,
        "name": plan.name,
        "instructions": plan.instructions,
        "start_date": plan.start_date.isoformat(),
        "schedule_time": plan.schedule_time.isoformat(),
        "every_n_days": plan.every_n_days,
        "is_active": plan.is_active,
    }


@map_domain_errors
def take_medication_dose(
    session_factory: SessionFactory, user_email: str | None, medication_dose_instance_id: int, taken_at: str | None = None
) -> dict[str, Any]:
    parsed_taken_at: datetime | None = None
    if taken_at is not None:
        try:
            parsed_taken_at = datetime.fromisoformat(taken_at)
        except ValueError:
            raise ValueError(f"Invalid taken_at format: '{taken_at}'. Expected ISO 8601 datetime.")
    return _mutate_medication(session_factory, user_email, medication_dose_instance_id, "take", taken_at=parsed_taken_at)


@map_domain_errors
def skip_medication_dose(session_factory: SessionFactory, user_email: str | None, medication_dose_instance_id: int) -> dict[str, Any]:
    return _mutate_medication(session_factory, user_email, medication_dose_instance_id, "skip")


def _mutate_medication(
    session_factory: SessionFactory,
    user_email: str | None,
    medication_dose_instance_id: int,
    action: str,
    *,
    taken_at: datetime | None = None,
) -> dict[str, Any]:
    def _op(_db: Session, principal: McpPrincipal, service: TodayService) -> dict[str, Any]:
        instance = service.mutate_medication_status(
            principal.user.id, medication_dose_instance_id, action, taken_at=taken_at, actor=principal.to_audit_actor()
        )
        return {
            "medication_dose_instance_id": instance.id,
            "medication_plan_id": instance.medication_plan_id,
            "name": instance.name,
            "status": instance.status.value,
            "scheduled_date": instance.scheduled_date.isoformat(),
            "scheduled_at": instance.scheduled_at.isoformat(),
            "taken_at": instance.taken_at.isoformat() if instance.taken_at else None,
            "skipped_at": instance.skipped_at.isoformat() if instance.skipped_at else None,
            "missed_at": instance.missed_at.isoformat() if instance.missed_at else None,
        }

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def skip_missed_medication_doses(session_factory: SessionFactory, user_email: str | None, before_date: str | None = None) -> dict[str, Any]:
    parsed = parse_date(before_date) if before_date else None

    def _op(_db: Session, principal: McpPrincipal, service: TodayService) -> dict[str, Any]:
        count, cutoff = service.skip_missed_medication_doses(user_id=principal.user.id, before_date=parsed, actor=principal.to_audit_actor())
        return {"skipped_count": count, "before_date": cutoff.isoformat()}

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def list_medications(session_factory: SessionFactory, user_email: str | None) -> list[dict[str, Any]]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: [_medication_plan_to_dict(p) for p in service.list_medication_plans(principal.user.id)],
    )


@map_domain_errors
def create_medication(
    session_factory: SessionFactory,
    user_email: str | None,
    *,
    name: str,
    instructions: str,
    start_date: str,
    schedule_time: str,
    every_n_days: int = 1,
) -> dict[str, Any]:
    parsed_start = date.fromisoformat(start_date)
    parsed_time = time.fromisoformat(schedule_time)

    def _op(_db: Session, principal: McpPrincipal, service: TodayService) -> dict[str, Any]:
        return _medication_plan_to_dict(
            service.create_medication_plan(
                principal.user.id,
                name=name,
                instructions=instructions,
                start_date=parsed_start,
                schedule_time=parsed_time,
                every_n_days=every_n_days,
                actor=principal.to_audit_actor(),
            )
        )

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def update_medication(
    session_factory: SessionFactory,
    user_email: str | None,
    *,
    medication_plan_id: int,
    name: str,
    instructions: str,
    start_date: str,
    schedule_time: str,
    every_n_days: int | None = None,
    is_active: bool | None = None,
) -> dict[str, Any]:
    parsed_start = date.fromisoformat(start_date)
    parsed_time = time.fromisoformat(schedule_time)

    def _op(_db: Session, principal: McpPrincipal, service: TodayService) -> dict[str, Any]:
        return _medication_plan_to_dict(
            service.update_medication_plan(
                principal.user.id,
                medication_plan_id,
                name=name,
                instructions=instructions,
                start_date=parsed_start,
                schedule_time=parsed_time,
                every_n_days=every_n_days,
                is_active=is_active,
                actor=principal.to_audit_actor(),
            )
        )

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def delete_medication(session_factory: SessionFactory, user_email: str | None, medication_plan_id: int) -> dict[str, Any]:
    with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: service.delete_medication_plan(
            principal.user.id, medication_plan_id, actor=principal.to_audit_actor()
        ),
    )
    return {"deleted": True, "medication_plan_id": medication_plan_id}


@map_domain_errors
def get_medication_history(
    session_factory: SessionFactory, user_email: str | None, limit: int = DEFAULT_MEDICATION_HISTORY_LIMIT, medication_plan_id: int | None = None
) -> dict[str, Any]:
    capped_limit = clamp_limit(limit, default=DEFAULT_MEDICATION_HISTORY_LIMIT, maximum=MAX_MEDICATION_HISTORY_LIMIT)

    def _op(_db: Session, principal: McpPrincipal, service: TodayService) -> dict[str, Any]:
        return {
            "history": [
                {
                    "medication_dose_instance_id": item.id,
                    "medication_plan_id": item.medication_plan_id,
                    "name": item.name,
                    "instructions": item.instructions,
                    "scheduled_at": item.scheduled_at.isoformat(),
                    "status": item.status.value,
                }
                for item in service.repository.get_medication_history(
                    user_id=principal.user.id,
                    before_date=datetime.now(UTC).date(),
                    limit=capped_limit,
                    medication_plan_id=medication_plan_id,
                )
            ]
        }

    return with_today_service(session_factory, user_email, _op)
