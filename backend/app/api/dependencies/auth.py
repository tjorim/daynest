from dataclasses import dataclass
from enum import StrEnum

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.oidc import OIDCTokenError, _extract_roles, decode_oidc_token, get_or_create_local_user
from app.db.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


class AuthType(StrEnum):
    KEYCLOAK_USER = "keycloak_user"
    KEYCLOAK_SERVICE = "keycloak_service"
    INTEGRATION = "integration"
    DELEGATED = "delegated"


@dataclass(frozen=True)
class AuthorizationPrincipal:
    subject: str
    user_id: int
    client_id: str | None
    auth_type: AuthType
    roles: frozenset[str] = frozenset()
    scopes: frozenset[str] = frozenset()


def _is_keycloak_service_account(claims: dict[str, object]) -> bool:
    username = claims.get("preferred_username")
    return isinstance(username, str) and username.startswith("service-account-")


def _set_request_auth_state(request: Request, user: User, claims: dict[str, object]) -> None:
    roles = frozenset(_extract_roles(claims))
    client_id = claims.get("azp")
    scope = claims.get("scope")
    principal = AuthorizationPrincipal(
        subject=str(claims["sub"]),
        user_id=user.id,
        client_id=client_id if isinstance(client_id, str) else None,
        auth_type=AuthType.KEYCLOAK_USER,
        roles=roles,
        scopes=frozenset(scope.split()) if isinstance(scope, str) else frozenset(),
    )
    request.state.principal = principal
    request.state.user_id = user.id
    request.state.roles = roles
    request.state.oidc_session_id = claims.get("sid")
    request.state.auth_type = principal.auth_type


def _resolve_user_from_claims(request: Request, db: Session, claims: dict[str, object]) -> User:
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    if _is_keycloak_service_account(claims):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keycloak service accounts cannot use the user REST API",
        )

    user = get_or_create_local_user(subject, claims, db)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account inactive")

    _set_request_auth_state(request, user, claims)
    return user


async def get_current_user_optional(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        claims = await decode_oidc_token(credentials.credentials)
    except OIDCTokenError:
        return None
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        return None
    if _is_keycloak_service_account(claims):
        return None
    user = get_or_create_local_user(subject, claims, db)
    if not user.is_active:
        return None
    _set_request_auth_state(request, user, claims)
    return user


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        claims = await decode_oidc_token(credentials.credentials)
    except OIDCTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return _resolve_user_from_claims(request, db, claims)


async def get_current_user_from_query_token(
    request: Request,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> User:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        claims = await decode_oidc_token(token)
    except OIDCTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return _resolve_user_from_claims(request, db, claims)
