import logging
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.dependencies.auth import bearer_scheme, get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import OAuthSessionResponse, OidcDiscoveryConfig, UserMeResponse, UserUpdateRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_http_client = httpx.AsyncClient(timeout=10)


async def close_http_client() -> None:
    await _http_client.aclose()


def _user_to_response(user: User, roles: list[str]) -> UserMeResponse:
    return UserMeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        timezone=user.timezone,
        roles=roles,
    )


# Discovery results are stable for the lifetime of the process; keyed by issuer
# so a config change is picked up.
_oidc_config_cache: dict[str, OidcDiscoveryConfig] = {}


async def discover_oidc_endpoints() -> OidcDiscoveryConfig:
    """Resolve public OIDC endpoints from the provider's discovery document.

    Endpoints come from the provider's standard discovery document so any OIDC
    provider (Keycloak, authentik, ...) works without provider-specific URL
    paths. Raises HTTPException 503 when OIDC is unconfigured or discovery fails.
    """
    if not settings.oidc_issuer_url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OIDC not configured on this server")
    issuer = settings.oidc_issuer_url.rstrip("/")
    cached = _oidc_config_cache.get(issuer)
    if cached is not None:
        return cached

    discovery_url = f"{issuer}/.well-known/openid-configuration"
    try:
        resp = await _http_client.get(discovery_url)
    except httpx.RequestError as exc:
        logger.error("Failed to reach OIDC discovery endpoint %s: %s", discovery_url, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC discovery failed",
        ) from exc
    if not resp.is_success:
        logger.error("OIDC discovery endpoint %s returned HTTP %s", discovery_url, resp.status_code)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC discovery failed",
        )
    try:
        data = resp.json()
        config = OidcDiscoveryConfig.model_validate(
            {
                "issuer": data.get("issuer", issuer),
                "authorization_url": data["authorization_endpoint"],
                "token_url": data["token_endpoint"],
                "end_session_endpoint": data.get("end_session_endpoint"),
            }
        )
    except (KeyError, ValueError) as exc:
        logger.error("Invalid OIDC discovery document from %s: %s", discovery_url, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC discovery failed",
        ) from exc
    _oidc_config_cache[issuer] = config
    return config


@router.get("/oidc-config", response_model=OidcDiscoveryConfig)
async def oidc_config() -> OidcDiscoveryConfig:
    """Return OIDC discovery config (unauthenticated). All clients use this to discover provider endpoints."""
    return await discover_oidc_endpoints()


@router.get("/me", response_model=UserMeResponse)
async def me(request: Request, current_user: User = Depends(get_current_user)) -> UserMeResponse:
    return _user_to_response(current_user, getattr(request.state, "roles", []))


@router.patch("/me", response_model=UserMeResponse)
async def update_me(
    request: Request,
    body: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserMeResponse:
    current_user.timezone = body.timezone
    db.commit()
    db.refresh(current_user)
    return _user_to_response(current_user, getattr(request.state, "roles", []))


@router.get("/sessions", response_model=list[OAuthSessionResponse])
async def list_sessions(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
) -> list[OAuthSessionResponse]:
    """List active OAuth sessions for the current user via the OIDC provider's Account API."""
    if not settings.oidc_issuer_url:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OIDC not configured; session listing is unavailable.",
        )
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    account_url = f"{settings.oidc_issuer_url.rstrip('/')}/account/sessions"
    try:
        resp = await _http_client.get(
            account_url,
            headers={"Authorization": f"Bearer {credentials.credentials}", "Accept": "application/json"},
        )
    except httpx.RequestError as exc:
        logger.error("Failed to reach OIDC Account API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the OIDC provider.",
        ) from exc

    if not resp.is_success:
        raise HTTPException(
            status_code=resp.status_code,
            detail="Failed to retrieve sessions from the OIDC provider.",
        )

    raw_sessions = resp.json()
    if not isinstance(raw_sessions, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid response from OIDC provider.",
        )
    return [
        OAuthSessionResponse(
            id=s["id"],
            ip_address=s.get("ipAddress"),
            started=s.get("started"),
            last_access=s.get("lastAccess"),
            expires=s.get("expires"),
            clients=s.get("clients") or [],
        )
        for s in raw_sessions
        if isinstance(s, dict) and s.get("id")
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
) -> None:
    """Revoke a specific OAuth session for the current user via the OIDC provider's Account API."""
    if not settings.oidc_issuer_url:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OIDC not configured; session revocation is unavailable.",
        )
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    account_url = f"{settings.oidc_issuer_url.rstrip('/')}/account/sessions/{quote(session_id)}"
    try:
        resp = await _http_client.delete(
            account_url,
            headers={"Authorization": f"Bearer {credentials.credentials}"},
        )
    except httpx.RequestError as exc:
        logger.error("Failed to reach OIDC Account API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the OIDC provider.",
        ) from exc

    if not resp.is_success:
        raise HTTPException(
            status_code=resp.status_code,
            detail="Failed to revoke session.",
        )
