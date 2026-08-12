"""Identity and integration-client MCP tools.

Covers ``whoami``, ``list_users``, and integration-client management — the
credentials MCP clients themselves authenticate with.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from secrets import token_urlsafe
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies.integration_auth import (
    INTEGRATION_KEY_PREFIX,
    hash_integration_key,
)
from app.mcp import principal as principal_module
from app.mcp.context import session_scope
from app.models.integration_client import IntegrationClient
from app.models.user import User
from app.services.audit_service import write_audit_entry


def _integration_client_to_dict(client: IntegrationClient) -> dict[str, Any]:
    return {
        "id": client.id,
        "name": client.name,
        "rate_limit_per_minute": client.rate_limit_per_minute,
        "scopes": client.scopes,
        "is_active": client.is_active,
    }


def whoami(session_factory: Callable[[], Session], user_email: str | None) -> dict[str, Any]:
    with session_scope(session_factory) as db:
        principal = principal_module.resolve_principal(db, user_email=user_email)
        user = principal.user
        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
        }


def list_users(session_factory: Callable[[], Session], user_email: str | None = None) -> list[dict[str, Any]]:
    with session_scope(session_factory) as db:
        principal_module.resolve_principal(db, user_email=user_email)
        users = list(db.scalars(select(User).order_by(User.id.asc())).all())
        return [
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
            }
            for user in users
        ]


def list_integration_clients(session_factory: Callable[[], Session], user_email: str | None) -> list[dict[str, Any]]:
    with session_scope(session_factory) as db:
        principal = principal_module.resolve_principal(db, user_email=user_email)
        clients = list(
            db.scalars(
                select(IntegrationClient)
                .where(IntegrationClient.user_id == principal.user.id)
                .order_by(IntegrationClient.id.asc())
            ).all()
        )
        return [_integration_client_to_dict(client) for client in clients]


def create_integration_client(
    session_factory: Callable[[], Session],
    user_email: str | None,
    *,
    name: str,
    rate_limit_per_minute: int = 120,
) -> dict[str, Any]:
    if not isinstance(rate_limit_per_minute, int) or rate_limit_per_minute <= 0:
        raise ValueError("rate_limit_per_minute must be a positive integer")
    if rate_limit_per_minute > 600:
        raise ValueError("rate_limit_per_minute must be 600 or less")

    raw_key = f"{INTEGRATION_KEY_PREFIX}{token_urlsafe(30)}"
    with session_scope(session_factory) as db:
        principal = principal_module.resolve_principal(db, user_email=user_email)
        if principal.auth_source == "integration":
            raise PermissionError("Integration tokens cannot create new integration clients")
        client = IntegrationClient(
            user_id=principal.user.id,
            name=name,
            key_hash=hash_integration_key(raw_key),
            rate_limit_per_minute=rate_limit_per_minute,
            scopes=["mcp:*"],
            is_active=True,
        )
        db.add(client)
        db.flush()
        write_audit_entry(
            db,
            actor=principal.to_audit_actor(),
            action="integration_client.create",
            resource_type="integration_client",
            resource_id=str(client.id),
            details={"name": client.name, "scopes": client.scopes},
        )
        db.commit()
        db.refresh(client)
        return {**_integration_client_to_dict(client), "api_key": raw_key}


def rotate_integration_client(
    session_factory: Callable[[], Session], user_email: str | None, client_id: int
) -> dict[str, Any]:
    raw_key = f"{INTEGRATION_KEY_PREFIX}{token_urlsafe(30)}"
    with session_scope(session_factory) as db:
        principal = principal_module.resolve_principal(db, user_email=user_email)
        if principal.auth_source == "integration":
            raise PermissionError("Integration tokens cannot rotate integration clients")
        client = db.scalar(
            select(IntegrationClient).where(
                IntegrationClient.id == client_id,
                IntegrationClient.user_id == principal.user.id,
            )
        )
        if client is None:
            raise ValueError("Integration client not found")
        if not client.is_active or client.revoked_at is not None:
            raise ValueError("Revoked integration clients cannot be rotated")
        client.key_hash = hash_integration_key(raw_key)
        client.key_preview = raw_key[-8:]
        write_audit_entry(
            db,
            actor=principal.to_audit_actor(),
            action="integration_client.rotate",
            resource_type="integration_client",
            resource_id=str(client.id),
        )
        db.commit()
        db.refresh(client)
        return {**_integration_client_to_dict(client), "api_key": raw_key}


def revoke_integration_client(
    session_factory: Callable[[], Session], user_email: str | None, client_id: int
) -> dict[str, Any]:
    with session_scope(session_factory) as db:
        principal = principal_module.resolve_principal(db, user_email=user_email)
        if principal.auth_source == "integration":
            raise PermissionError("Integration tokens cannot revoke integration clients")
        client = db.scalar(
            select(IntegrationClient).where(
                IntegrationClient.id == client_id,
                IntegrationClient.user_id == principal.user.id,
            )
        )
        if client is None:
            raise ValueError("Integration client not found")
        client.is_active = False
        client.revoked_at = datetime.now(UTC)
        write_audit_entry(
            db,
            actor=principal.to_audit_actor(),
            action="integration_client.revoke",
            resource_type="integration_client",
            resource_id=str(client.id),
        )
        db.commit()
        return {"revoked": True, "client_id": client_id}
