"""Chore-instance/routine-task mutation and chore/routine-template CRUD MCP tools."""

from __future__ import annotations

from collections.abc import Callable
from datetime import time
from typing import Any

from sqlalchemy.orm import Session

from app.core.enums import Priority
from app.mcp.context import jsonable, parse_date, with_today_service
from app.mcp.errors import map_domain_errors
from app.mcp.principal import McpPrincipal
from app.services.today_service import TodayService

SessionFactory = Callable[[], Session]


def _routine_template_to_dict(t: Any) -> dict[str, Any]:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "start_date": t.start_date.isoformat(),
        "every_n_days": t.every_n_days,
        "rrule": t.rrule,
        "due_time": t.due_time.isoformat() if t.due_time else None,
        "is_active": t.is_active,
    }


def _chore_template_to_dict(t: Any) -> dict[str, Any]:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "start_date": t.start_date.isoformat(),
        "every_n_days": t.every_n_days,
        "rrule": t.rrule,
        "priority": t.priority,
        "tags": t.tags or [],
        "is_active": t.is_active,
    }


# --- Chore instances ---------------------------------------------------


@map_domain_errors
def complete_chore(session_factory: SessionFactory, user_email: str | None, chore_instance_id: int) -> dict[str, Any]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.complete_chore(principal.user.id, chore_instance_id, actor=principal.to_audit_actor())
        ),
    )


@map_domain_errors
def skip_chore(session_factory: SessionFactory, user_email: str | None, chore_instance_id: int) -> dict[str, Any]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.skip_chore(principal.user.id, chore_instance_id, actor=principal.to_audit_actor())
        ),
    )


@map_domain_errors
def reschedule_chore(session_factory: SessionFactory, user_email: str | None, chore_instance_id: int, scheduled_date: str) -> dict[str, Any]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.reschedule_chore(principal.user.id, chore_instance_id, parse_date(scheduled_date), actor=principal.to_audit_actor())
        ),
    )


# --- Routine tasks -------------------------------------------------------


@map_domain_errors
def start_routine_task(session_factory: SessionFactory, user_email: str | None, task_instance_id: int) -> dict[str, Any]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.start_routine_task(principal.user.id, task_instance_id, actor=principal.to_audit_actor())
        ),
    )


@map_domain_errors
def complete_routine_task(session_factory: SessionFactory, user_email: str | None, task_instance_id: int) -> dict[str, Any]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.complete_routine_task(principal.user.id, task_instance_id, actor=principal.to_audit_actor())
        ),
    )


@map_domain_errors
def skip_routine_task(session_factory: SessionFactory, user_email: str | None, task_instance_id: int) -> dict[str, Any]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.skip_routine_task(principal.user.id, task_instance_id, actor=principal.to_audit_actor())
        ),
    )


# --- Routine templates -----------------------------------------------------


@map_domain_errors
def list_routines(session_factory: SessionFactory, user_email: str | None) -> list[dict[str, Any]]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: [_routine_template_to_dict(t) for t in service.list_routine_templates(principal.user.id)],
    )


@map_domain_errors
def create_routine(
    session_factory: SessionFactory,
    user_email: str | None,
    *,
    name: str,
    start_date: str,
    every_n_days: int = 1,
    description: str | None = None,
    due_time: str | None = None,
    is_active: bool = True,
) -> dict[str, Any]:
    parsed_start = parse_date(start_date)
    parsed_due_time = time.fromisoformat(due_time) if due_time and due_time.strip() else None

    def _op(_db: Session, principal: McpPrincipal, service: TodayService) -> dict[str, Any]:
        return _routine_template_to_dict(
            service.create_routine_template(
                principal.user.id,
                name=name,
                start_date=parsed_start,
                every_n_days=every_n_days,
                description=description,
                due_time=parsed_due_time,
                is_active=is_active,
                actor=principal.to_audit_actor(),
            )
        )

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def update_routine(
    session_factory: SessionFactory,
    user_email: str | None,
    *,
    routine_template_id: int,
    name: str,
    start_date: str,
    every_n_days: int | None = None,
    description: str | None = None,
    due_time: str | None = None,
    is_active: bool | None = None,
) -> dict[str, Any]:
    parsed_start = parse_date(start_date)
    parsed_due_time = time.fromisoformat(due_time) if due_time and due_time.strip() else None

    def _op(_db: Session, principal: McpPrincipal, service: TodayService) -> dict[str, Any]:
        existing = service.repository.get_routine_template_for_user(principal.user.id, routine_template_id)
        return _routine_template_to_dict(
            service.update_routine_template(
                principal.user.id,
                routine_template_id,
                name=name,
                start_date=parsed_start,
                every_n_days=every_n_days,
                rrule=existing.rrule if existing else None,
                description=description,
                due_time=parsed_due_time,
                is_active=is_active,
                actor=principal.to_audit_actor(),
            )
        )

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def delete_routine(session_factory: SessionFactory, user_email: str | None, routine_template_id: int) -> dict[str, Any]:
    with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: service.delete_routine_template(
            principal.user.id, routine_template_id, actor=principal.to_audit_actor()
        ),
    )
    return {"deleted": True, "routine_template_id": routine_template_id}


# --- Chore templates ---------------------------------------------------


@map_domain_errors
def list_chore_templates(session_factory: SessionFactory, user_email: str | None) -> list[dict[str, Any]]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: [_chore_template_to_dict(t) for t in service.list_chore_templates(principal.user.id)],
    )


@map_domain_errors
def create_chore_template(
    session_factory: SessionFactory,
    user_email: str | None,
    *,
    name: str,
    start_date: str,
    every_n_days: int = 1,
    description: str | None = None,
    is_active: bool = True,
) -> dict[str, Any]:
    parsed_start = parse_date(start_date)

    def _op(_db: Session, principal: McpPrincipal, service: TodayService) -> dict[str, Any]:
        return _chore_template_to_dict(
            service.create_chore_template(
                principal.user.id,
                name=name,
                start_date=parsed_start,
                every_n_days=every_n_days,
                description=description,
                is_active=is_active,
                actor=principal.to_audit_actor(),
            )
        )

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def update_chore_template(
    session_factory: SessionFactory,
    user_email: str | None,
    *,
    chore_template_id: int,
    name: str,
    start_date: str,
    every_n_days: int | None = None,
    description: str | None = None,
    is_active: bool | None = None,
) -> dict[str, Any]:
    parsed_start = parse_date(start_date)

    def _op(_db: Session, principal: McpPrincipal, service: TodayService) -> dict[str, Any]:
        existing = service.repository.get_chore_template_for_user(principal.user.id, chore_template_id)
        return _chore_template_to_dict(
            service.update_chore_template(
                principal.user.id,
                chore_template_id,
                name=name,
                start_date=parsed_start,
                every_n_days=every_n_days,
                rrule=existing.rrule if existing else None,
                priority=existing.priority if existing else Priority.normal,
                tags=existing.tags if existing else [],
                description=description,
                is_active=is_active,
                actor=principal.to_audit_actor(),
            )
        )

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def delete_chore_template(session_factory: SessionFactory, user_email: str | None, chore_template_id: int) -> dict[str, Any]:
    with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: service.delete_chore_template(
            principal.user.id, chore_template_id, actor=principal.to_audit_actor()
        ),
    )
    return {"deleted": True, "chore_template_id": chore_template_id}
