"""Resolve the authenticated MCP principal once per tool call.

Ports the auth-resolution logic that used to live inline in
``DaynestMcpBackend.resolve_user`` — same behavior, same error messages —
but returns a full :class:`McpPrincipal` (auth source, integration client id,
subject, scopes) instead of only the ``User``, so callers can build an
:class:`~app.services.audit_service.AuditActor` without re-deriving auth
context, and so domain modules never need to know how auth was resolved.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

from fastmcp.server.dependencies import get_access_token
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.integration_auth import has_required_scopes
from app.core.oidc import get_or_create_local_user
from app.models.integration_client import IntegrationClient
from app.models.user import User
from app.services.audit_service import AuditActor, AuditAuthSource

logger = logging.getLogger(__name__)

DAYNEST_USER_EMAIL_ENV = "DAYNEST_USER_EMAIL"


@dataclass(frozen=True)
class McpPrincipal:
    """Immutable identity resolved once per MCP tool call."""

    user: User
    auth_source: AuditAuthSource
    subject: str | None = None
    integration_client_id: int | None = None
    scopes: tuple[str, ...] = field(default_factory=tuple)

    def to_audit_actor(self) -> AuditActor:
        return AuditActor(
            user_id=self.user.id,
            auth_source=self.auth_source,
            subject=self.subject,
            integration_client_id=self.integration_client_id,
        )


def resolve_principal(db: Session, *, user_email: str | None = None) -> McpPrincipal:
    """Resolve the authenticated principal for the current MCP request.

    Resolution order (unchanged from the pre-#726 ``resolve_user``):
    1. An authenticated integration-client token (``auth_source=integration``).
    2. An authenticated Keycloak service-account token mapped to a local user
       (``auth_source=keycloak_service``).
    3. An authenticated Keycloak OIDC user token (``auth_source=oidc``).
    4. Local-dev fallback: ``user_email``/``DAYNEST_USER_EMAIL``, or the sole
       active user if there is exactly one (``auth_source=local``).
    """

    access_token = get_access_token()
    if access_token is not None:
        auth_source = access_token.claims.get("auth_source")

        if auth_source == "integration":
            integration_client_id = access_token.claims.get("integration_client_id")
            if integration_client_id is None:
                raise ValueError(
                    "Authenticated MCP integration token is missing a client ID"
                )
            # verify_token stores only an AccessToken in request context — re-query with joinedload.
            stmt = (
                select(IntegrationClient)
                .where(IntegrationClient.id == integration_client_id)
                .options(joinedload(IntegrationClient.user))
            )
            client = db.scalar(stmt)
            if client is None or not client.is_active:
                raise ValueError(
                    "Authenticated MCP integration client is inactive or missing"
                )
            if client.user is None or not client.user.is_active:
                raise ValueError(
                    "Authenticated integration owner not found or inactive"
                )
            if not has_required_scopes(set(client.scopes), frozenset({"mcp:*"})):
                raise PermissionError("Integration client is not authorized to use MCP")
            return McpPrincipal(
                user=client.user,
                auth_source="integration",
                subject=f"integration:{client.id}",
                integration_client_id=client.id,
                scopes=tuple(client.scopes),
            )

        # OIDC path: KeycloakAuthProvider sets standard JWT claims including sub
        oidc_subject = access_token.claims.get("sub")
        if not oidc_subject:
            raise ValueError("Authenticated MCP OIDC token is missing a subject")
        preferred_username = access_token.claims.get("preferred_username")
        if isinstance(preferred_username, str) and preferred_username.startswith(
            "service-account-"
        ):
            raw_user_id = access_token.claims.get("daynest_user_id")
            if raw_user_id is None:
                raise PermissionError(
                    "Keycloak service accounts require a daynest_user_id protocol mapper"
                )
            try:
                mapped_user_id = int(raw_user_id)
            except (TypeError, ValueError) as exc:
                raise PermissionError(
                    "Keycloak service accounts require a daynest_user_id protocol mapper"
                ) from exc
            user = db.get(User, mapped_user_id)
            if user is None or not user.is_active:
                raise ValueError(
                    "Mapped Daynest service-account user is inactive or missing"
                )
            return McpPrincipal(
                user=user, auth_source="keycloak_service", subject=str(oidc_subject)
            )

        user = get_or_create_local_user(oidc_subject, access_token.claims, db)
        if not user.is_active:
            raise ValueError(f"User for OIDC subject {oidc_subject} is inactive")
        return McpPrincipal(user=user, auth_source="oidc", subject=str(oidc_subject))

    configured_email = user_email or os.getenv(DAYNEST_USER_EMAIL_ENV)
    if configured_email:
        user = db.scalar(
            select(User)
            .where(User.email == configured_email.lower())
            .where(User.is_active.is_(True))
        )
        if user is None:
            raise ValueError(
                f"Active user not found for {DAYNEST_USER_EMAIL_ENV}={configured_email}"
            )
        return McpPrincipal(user=user, auth_source="local", subject=user.email)

    active_users = list(
        db.scalars(
            select(User).where(User.is_active.is_(True)).order_by(User.id.asc())
        ).all()
    )
    if not active_users:
        raise ValueError(
            "No active Daynest user found. Create an account first or set "
            f"{DAYNEST_USER_EMAIL_ENV}=you@example.com."
        )
    if len(active_users) > 1:
        logger.debug(
            "Multiple active users: %s",
            ", ".join(user.email for user in active_users),
        )
        raise ValueError(
            f"Multiple active Daynest users found ({len(active_users)} matches). "
            f"Set {DAYNEST_USER_EMAIL_ENV} to the correct account or inspect active users locally."
        )
    return McpPrincipal(
        user=active_users[0], auth_source="local", subject=active_users[0].email
    )
