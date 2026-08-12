"""Bounded, user-scoped audit-trail read tool.

Deliberately does NOT expose any cross-user/household visibility — Daynest
has no global-admin audit model (unlike Champagne Festival). Every read is
scoped to ``resolve_principal(...).user.id``, matching how every other
list/read tool in this codebase is already scoped to the authenticated user.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.mcp.context import parse_date, with_principal
from app.mcp.errors import map_domain_errors
from app.mcp.principal import McpPrincipal
from app.services.audit_service import DEFAULT_AUDIT_LIMIT
from app.services.audit_service import list_audit_entries as query_audit_entries

SessionFactory = Callable[[], Session]


def _parse_datetime_boundary(value: str | None, *, is_until: bool = False) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        else:
            dt = dt.astimezone(UTC)
        return dt
    except ValueError:
        # Fall back to date-only input (e.g. "2026-05-01") for convenience.
        parsed_date = parse_date(value)
        if is_until:
            return datetime.combine(parsed_date, datetime.max.time(), tzinfo=UTC)
        return datetime.combine(parsed_date, datetime.min.time(), tzinfo=UTC)


@map_domain_errors
def list_audit_entries(
    session_factory: SessionFactory,
    user_email: str | None,
    *,
    resource_type: str | None = None,
    resource_id: str | None = None,
    action: str | None = None,
    since: str | None = None,
    until: str | None = None,
    limit: int = DEFAULT_AUDIT_LIMIT,
    before_id: int | None = None,
) -> dict[str, Any]:
    """Return the authenticated user's own audit-trail entries, newest first."""

    def _op(db: Session, principal: McpPrincipal) -> dict[str, Any]:
        entries = query_audit_entries(
            db,
            actor_user_id=principal.user.id,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            since=_parse_datetime_boundary(since),
            until=_parse_datetime_boundary(until, is_until=True),
            limit=limit,
            before_id=before_id,
        )
        return {
            "entries": [
                {
                    "id": entry.id,
                    "timestamp": entry.timestamp.isoformat(),
                    "actor_user_id": entry.actor_user_id,
                    "auth_source": entry.auth_source,
                    "subject": entry.subject,
                    "integration_client_id": entry.integration_client_id,
                    "action": entry.action,
                    "resource_type": entry.resource_type,
                    "resource_id": entry.resource_id,
                    "request_id": entry.request_id,
                    "details": entry.details,
                }
                for entry in entries
            ],
            "next_before_id": entries[-1].id if len(entries) == limit else None,
        }

    return with_principal(session_factory, user_email, _op)
