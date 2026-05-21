from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.oidc import OIDCTokenError, _extract_roles, decode_oidc_token, get_or_create_local_user
from app.db.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def _set_request_auth_state(request: Request, user: User, claims: dict[str, object]) -> None:
    request.state.user_id = user.id
    request.state.roles = _extract_roles(claims)


def _resolve_user_from_claims(request: Request, db: Session, claims: dict[str, object]) -> User:
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

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
