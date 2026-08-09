"""Today/calendar views and planned items MCP tools."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal, cast

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.enums import Priority
from app.mcp.context import (
    jsonable,
    parse_date,
    parse_time,
    with_principal,
    with_today_service,
)
from app.mcp.errors import map_domain_errors
from app.mcp.principal import McpPrincipal
from app.repositories.analytics_repository import (
    get_scheduling_suggestions as build_scheduling_suggestions,
)
from app.schemas.today import (
    PlannedItemCreateRequest,
    PlannedItemModuleKey,
    PlannedItemUpdateRequest,
)
from app.services.today_service import TodayService

SessionFactory = Callable[[], Session]


@map_domain_errors
def get_today(
    session_factory: SessionFactory, user_email: str | None, for_date: str | None = None
) -> dict[str, Any]:
    target_date = parse_date(for_date)
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, _principal, service: jsonable(
            service.get_today(_principal.user.id, target_date)
        ),
    )


@map_domain_errors
def get_calendar_day(
    session_factory: SessionFactory, user_email: str | None, for_date: str | None = None
) -> dict[str, Any]:
    target_date = parse_date(for_date)
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.get_day_items(principal.user.id, target_date)
        ),
    )


@map_domain_errors
def get_calendar_month(
    session_factory: SessionFactory, user_email: str | None, year: int, month: int
) -> dict[str, Any]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.get_month(principal.user.id, year, month)
        ),
    )


@map_domain_errors
def list_planned_items(
    session_factory: SessionFactory,
    user_email: str | None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    parsed_start = parse_date(start_date) if start_date else None
    parsed_end = parse_date(end_date) if end_date else None
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.list_planned_items(
                principal.user.id,
                start_date=parsed_start,
                end_date=parsed_end,
                limit=limit,
            )
        ),
    )


@map_domain_errors
def create_planned_item(
    session_factory: SessionFactory,
    user_email: str | None,
    *,
    title: str,
    planned_for: str,
    time_of_day: str | None = None,
    duration_minutes: int | None = None,
    notes: str | None = None,
    module_key: PlannedItemModuleKey | None = None,
    recurrence_hint: str | None = None,
    rrule: str | None = None,
    linked_source: str | None = None,
    linked_ref: str | None = None,
    priority: str = "normal",
    tags: list[str] | None = None,
) -> dict[str, Any]:
    request = PlannedItemCreateRequest(
        title=title,
        planned_for=parse_date(planned_for),
        time_of_day=parse_time(time_of_day),
        duration_minutes=duration_minutes,
        notes=notes,
        module_key=module_key,
        recurrence_hint=recurrence_hint,
        rrule=rrule,
        linked_source=linked_source,
        linked_ref=linked_ref,
        priority=Priority(priority),
        tags=tags or [],
    )

    def _op(
        _db: Session, principal: McpPrincipal, service: TodayService
    ) -> dict[str, Any]:
        return jsonable(
            service.create_planned_item(
                principal.user.id, request, actor=principal.to_audit_actor()
            )
        )

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def update_planned_item(
    session_factory: SessionFactory,
    user_email: str | None,
    *,
    planned_item_id: int,
    title: str | None = None,
    planned_for: str | None = None,
    time_of_day: str | None = None,
    duration_minutes: int | None = None,
    is_done: bool | None = None,
    notes: str | None = None,
    module_key: PlannedItemModuleKey | None = None,
    recurrence_hint: str | None = None,
    rrule: str | None = None,
    linked_source: str | None = None,
    linked_ref: str | None = None,
    priority: str | None = None,
    tags: list[str] | None = None,
    scope: Literal["this", "future", "all"] = "this",
) -> dict[str, Any]:
    def _op(
        _db: Session, principal: McpPrincipal, service: TodayService
    ) -> dict[str, Any]:
        existing = service.repository.get_planned_item_for_user(
            user_id=principal.user.id, planned_item_id=planned_item_id
        )
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Planned item not found"
            )
        request = PlannedItemUpdateRequest(
            title=title if title is not None else existing.title,
            planned_for=parse_date(planned_for)
            if planned_for is not None
            else existing.planned_for,
            time_of_day=parse_time(time_of_day)
            if time_of_day is not None
            else existing.time_of_day,
            duration_minutes=None
            if duration_minutes == 0
            else (
                duration_minutes
                if duration_minutes is not None
                else existing.duration_minutes
            ),
            is_done=is_done if is_done is not None else existing.is_done,
            notes=notes if notes is not None else existing.notes,
            module_key=module_key
            if module_key is not None
            else cast(PlannedItemModuleKey | None, existing.module_key),
            recurrence_hint=recurrence_hint
            if recurrence_hint is not None
            else existing.recurrence_hint,
            rrule=rrule if rrule is not None else existing.rrule,
            linked_source=linked_source
            if linked_source is not None
            else existing.linked_source,
            linked_ref=linked_ref if linked_ref is not None else existing.linked_ref,
            priority=Priority(priority) if priority is not None else existing.priority,
            tags=tags if tags is not None else (existing.tags or []),
        )
        return jsonable(
            service.update_planned_item(
                principal.user.id,
                planned_item_id,
                request,
                scope=scope,
                actor=principal.to_audit_actor(),
            )
        )

    return with_today_service(session_factory, user_email, _op)


@map_domain_errors
def defer_planned_item(
    session_factory: SessionFactory,
    user_email: str | None,
    planned_item_id: int,
    days: int = 1,
) -> dict[str, Any]:
    return with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: jsonable(
            service.defer_planned_item(
                principal.user.id,
                planned_item_id,
                days,
                actor=principal.to_audit_actor(),
            )
        ),
    )


@map_domain_errors
def delete_planned_item(
    session_factory: SessionFactory,
    user_email: str | None,
    planned_item_id: int,
    scope: Literal["this", "future"] = "this",
) -> dict[str, Any]:
    with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: service.delete_planned_item(
            principal.user.id,
            planned_item_id,
            scope=scope,
            actor=principal.to_audit_actor(),
        ),
    )
    return {"deleted": True, "planned_item_id": planned_item_id, "scope": scope}


@map_domain_errors
def delete_planned_item_series(
    session_factory: SessionFactory, user_email: str | None, recurrence_series_id: str
) -> dict[str, Any]:
    count = with_today_service(
        session_factory,
        user_email,
        lambda _db, principal, service: service.delete_planned_item_series(
            principal.user.id, recurrence_series_id, actor=principal.to_audit_actor()
        ),
    )
    return {
        "deleted": True,
        "recurrence_series_id": recurrence_series_id,
        "deleted_count": count,
    }


@map_domain_errors
def get_scheduling_suggestions(
    session_factory: SessionFactory, user_email: str | None, for_date: str | None = None
) -> dict[str, Any]:
    parsed_date = parse_date(for_date)

    def _op(db: Session, principal: McpPrincipal) -> dict[str, Any]:
        suggestions = build_scheduling_suggestions(db, principal.user.id, parsed_date)
        return {
            "for_date": parsed_date.isoformat(),
            "suggestions": [item.model_dump(mode="json") for item in suggestions],
        }

    return with_principal(session_factory, user_email, _op)
