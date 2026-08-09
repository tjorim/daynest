"""Shared transactional audit trail for REST and MCP mutations.

``write_audit_entry`` only stages an :class:`~app.models.audit_entry.AuditEntry`
on the session (``db.add`` — no commit). Callers are responsible for committing
it in the *same* transaction as the mutation it describes, so a mutation can
never be reported as successful without its audit record being durable too
(and a crash before commit rolls back both together).

Audit reads are scoped to the requesting user's own actor id — Daynest has no
household-wide "admin" visibility model (unlike Champagne Festival's global
admin audit reads), so ``list_audit_entries`` always filters by
``actor_user_id`` and never exposes another user's activity.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_entry import AuditEntry

# Auth sources recorded on audit entries. Mirrors the vocabulary used by MCP's
# principal resolution (app.mcp.principal.McpPrincipal) and REST's
# AuthorizationPrincipal (app.api.dependencies.auth.AuthType), normalized to a
# single string vocabulary so audit rows are comparable across both surfaces.
AuditAuthSource = Literal[
    "oidc", "keycloak_service", "integration", "local", "delegated"
]

DEFAULT_AUDIT_LIMIT = 100
MAX_AUDIT_LIMIT = 1000


@dataclass(frozen=True)
class AuditActor:
    """Who performed a mutation, for audit purposes.

    Deliberately minimal and decoupled from McpPrincipal/AuthorizationPrincipal
    so the audit module has no import-time dependency on either auth surface.
    """

    user_id: int
    auth_source: AuditAuthSource
    subject: str | None = None
    integration_client_id: int | None = None


def write_audit_entry(
    db: Session,
    *,
    actor: AuditActor,
    action: str,
    resource_type: str,
    resource_id: str,
    request_id: str | None = None,
    details: dict | None = None,
) -> None:
    """Stage an audit entry on ``db``. Does not commit.

    The caller must commit ``db`` as part of the same transaction as the
    mutation being audited (e.g. immediately after, or via the same
    ``session.commit()`` call that persists the mutation).
    """

    db.add(
        AuditEntry(
            actor_user_id=actor.user_id,
            auth_source=actor.auth_source,
            subject=actor.subject,
            integration_client_id=actor.integration_client_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            request_id=request_id,
            details=details or {},
        )
    )


def list_audit_entries(
    db: Session,
    *,
    actor_user_id: int,
    resource_type: str | None = None,
    resource_id: str | None = None,
    action: str | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    limit: int = DEFAULT_AUDIT_LIMIT,
    before_id: int | None = None,
) -> list[AuditEntry]:
    """Return audit entries for a single user, newest first.

    Always scoped to ``actor_user_id`` — callers must pass the authenticated
    user's own id. Ordered by ``(timestamp desc, id desc)`` for stable
    pagination even when multiple entries share a timestamp. ``before_id`` is
    an exclusive cursor resolved inside the same user boundary.
    """
    if limit < 1 or limit > MAX_AUDIT_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_AUDIT_LIMIT}")

    stmt = select(AuditEntry).where(AuditEntry.actor_user_id == actor_user_id)
    if resource_type is not None:
        stmt = stmt.where(AuditEntry.resource_type == resource_type)
    if resource_id is not None:
        stmt = stmt.where(AuditEntry.resource_id == resource_id)
    if action is not None:
        stmt = stmt.where(AuditEntry.action == action)
    if since is not None:
        stmt = stmt.where(AuditEntry.timestamp >= since)
    if until is not None:
        stmt = stmt.where(AuditEntry.timestamp <= until)
    if before_id is not None:
        cursor = db.scalar(
            select(AuditEntry).where(
                AuditEntry.id == before_id,
                AuditEntry.actor_user_id == actor_user_id,
            )
        )
        if cursor is None:
            raise ValueError("audit cursor does not exist for this user")
        stmt = stmt.where(
            (AuditEntry.timestamp < cursor.timestamp)
            | ((AuditEntry.timestamp == cursor.timestamp) & (AuditEntry.id < cursor.id))
        )
    stmt = stmt.order_by(AuditEntry.timestamp.desc(), AuditEntry.id.desc()).limit(limit)

    return list(db.scalars(stmt).all())
