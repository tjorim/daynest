"""FastAPI dependency that builds an AuditActor for the current REST request.

Reuses the AuthorizationPrincipal that ``get_current_user`` already stashes on
``request.state`` (see app.api.dependencies.auth._set_request_auth_state) so
REST routes can pass the same AuditActor shape into the shared services that
MCP tools use — one audit path for both surfaces.
"""

from __future__ import annotations

from fastapi import Depends, Request

from app.api.dependencies.auth import AuthorizationPrincipal, AuthType, get_current_user
from app.models.user import User
from app.services.audit_service import AuditActor, AuditAuthSource

_AUTH_TYPE_TO_AUDIT_SOURCE: dict[AuthType, AuditAuthSource] = {
    AuthType.KEYCLOAK_USER: "oidc",
    AuthType.KEYCLOAK_SERVICE: "keycloak_service",
    AuthType.INTEGRATION: "integration",
    AuthType.DELEGATED: "delegated",
}


def _integration_client_id(principal: AuthorizationPrincipal) -> int | None:
    if principal.auth_type != AuthType.INTEGRATION or principal.client_id is None:
        return None
    try:
        return int(principal.client_id)
    except ValueError:
        return None


def get_audit_actor(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> AuditActor:
    principal = getattr(request.state, "principal", None)
    if isinstance(principal, AuthorizationPrincipal):
        return AuditActor(
            user_id=current_user.id,
            auth_source=_AUTH_TYPE_TO_AUDIT_SOURCE.get(principal.auth_type, "oidc"),
            subject=principal.subject,
            integration_client_id=_integration_client_id(principal),
        )
    # get_current_user always authenticates via Keycloak-issued OIDC tokens for
    # the human-facing REST API (service accounts are rejected — see
    # _resolve_user_from_claims), so "oidc" is the correct fallback even when
    # request.state.principal wasn't set (e.g. dependency overrides in tests).
    return AuditActor(user_id=current_user.id, auth_source="oidc")
