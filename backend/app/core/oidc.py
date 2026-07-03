"""OIDC/JWT authentication for Daynest backend.

Validates Bearer JWTs issued by any OIDC-compliant provider (Keycloak, authentik, …)
and auto-provisions local user records on first login.

Configuration via AppSettings:
  OIDC_ISSUER_URL   — OIDC issuer URL (e.g. http://localhost:8080/realms/daynest)
  OIDC_AUDIENCE     — Expected audience claim (optional)
  OIDC_JWKS_URI     — JWKS endpoint override (auto-discovered via /.well-known/openid-configuration if omitted)
  OIDC_ALGORITHMS   — Comma-separated accepted algorithms (default RS256)

Token subject claim (``sub``) is the stable identity key.
On first login, existing users are linked by email to support migration from local auth.
Realm roles are extracted from the ``realm_access.roles`` JWT claim.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
import jwt
from jwt import PyJWKSet
from jwt.exceptions import ExpiredSignatureError, PyJWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

_OIDC_ALGORITHMS: list[str] = [a.strip() for a in settings.oidc_algorithms.split(",") if a.strip()]
_OIDC_AUDIENCE: str | None = settings.oidc_audience or None
_OIDC_ISSUER: str | None = settings.oidc_issuer_url or None

_http_client = httpx.AsyncClient(timeout=10)


class OIDCTokenError(Exception):
    """Raised when a JWT cannot be validated against the OIDC provider."""


_jwks_uri_cache: str | None = None
_jwks_uri_lock = asyncio.Lock()

_jwks_lock = asyncio.Lock()
_jwks_cache: PyJWKSet | None = None


async def _resolve_jwks_uri() -> str:
    """Return the JWKS URI, discovering it from the OIDC configuration document."""
    global _jwks_uri_cache  # noqa: PLW0603
    if settings.oidc_jwks_uri:
        return settings.oidc_jwks_uri
    async with _jwks_uri_lock:
        if _jwks_uri_cache is not None:
            return _jwks_uri_cache
        base = (settings.oidc_issuer_url or "").rstrip("/")
        try:
            resp = await _http_client.get(f"{base}/.well-known/openid-configuration")
            resp.raise_for_status()
            _jwks_uri_cache = resp.json()["jwks_uri"]
            logger.info("Discovered JWKS URI: %s", _jwks_uri_cache)
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise OIDCTokenError(f"OIDC discovery failed for {base}: {exc}") from exc
        return _jwks_uri_cache


async def check_jwks_reachable() -> bool:
    """Return True if the OIDC provider's JWKS endpoint is reachable.

    Kept short-timeout and quiet (no full traceback) since this backs a
    readiness probe that may be polled frequently.
    """
    try:
        jwks_uri = await _resolve_jwks_uri()
        response = await _http_client.get(jwks_uri, timeout=3.0)
        response.raise_for_status()
    except OIDCTokenError as exc:
        logger.error("JWKS reachability check failed: OIDC discovery failed: %s", exc)
        return False
    except Exception as exc:  # noqa: BLE001
        logger.error("JWKS reachability check failed: %s", exc)
        return False
    return True


async def _fetch_jwks() -> PyJWKSet:
    uri = await _resolve_jwks_uri()
    try:
        response = await _http_client.get(uri)
        response.raise_for_status()
        return PyJWKSet.from_dict(response.json())
    except OIDCTokenError:
        raise
    except (httpx.HTTPError, ValueError, KeyError, PyJWTError) as exc:
        logger.error("Failed to fetch JWKS from %s: %s", uri, exc)
        raise OIDCTokenError(f"Failed to fetch JWKS from {uri}: {exc}") from exc


async def _get_jwks(*, force_refresh: bool = False) -> PyJWKSet:
    global _jwks_cache  # noqa: PLW0603
    async with _jwks_lock:
        if _jwks_cache is None or force_refresh:
            _jwks_cache = await _fetch_jwks()
        return _jwks_cache


def _extract_roles(claims: dict[str, Any]) -> list[str]:
    """Extract realm-level roles from the ``realm_access.roles`` JWT claim."""
    realm_access = claims.get("realm_access")
    if not isinstance(realm_access, dict):
        return []
    roles = realm_access.get("roles", [])
    return roles if isinstance(roles, list) else []


async def decode_oidc_token(token: str) -> dict[str, Any]:
    """Decode and validate an OIDC-issued JWT.

    Tries cached JWKS first; refreshes once on key-not-found to handle key rotation.
    """
    options: Any = {
        "verify_aud": _OIDC_AUDIENCE is not None,
        "verify_iss": _OIDC_ISSUER is not None,
    }

    for attempt in range(2):
        try:
            jwks_set = await _get_jwks(force_refresh=(attempt == 1))
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            signing_key = next(
                (k for k in jwks_set.keys if kid is None or k.key_id == kid),
                None,
            )

            if signing_key is None:
                if attempt == 0:
                    logger.info("Signing key not found in cached JWKS — refreshing")
                    continue
                raise OIDCTokenError("Signing key not found in JWKS")

            claims: dict[str, Any] = jwt.decode(
                token,
                signing_key.key,
                algorithms=_OIDC_ALGORITHMS,
                audience=_OIDC_AUDIENCE,
                issuer=_OIDC_ISSUER,
                options=options,
            )
            return claims
        except ExpiredSignatureError as exc:
            raise OIDCTokenError("Token has expired") from exc
        except PyJWTError as exc:
            raise OIDCTokenError(f"Token validation failed: {exc}") from exc

    raise OIDCTokenError("Token validation failed after JWKS refresh")


def get_or_create_local_user(subject: str, claims: dict[str, Any], db: Session) -> "Any":
    """Return the local user for an OIDC subject, auto-provisioning when missing.

    Migration path: on first OIDC login, links existing local users by email so
    that accounts created under the old password-based auth are not orphaned.
    """
    from app.models.user import User

    user = db.scalar(select(User).where(User.oidc_subject == subject))
    if user is not None:
        return user

    email = (claims.get("email") or "").strip().lower()

    # Link existing user by email (migration from local auth)
    if email:
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            if existing.oidc_subject is None:
                existing.oidc_subject = subject
                db.commit()
                logger.info("Linked existing user %s to OIDC subject %s", email, subject)
            return existing

    full_name = (
        (claims.get("name") or "").strip()
        or (claims.get("preferred_username") or "").strip()
        or None
    )

    new_user = User(
        email=email or f"user-{subject[:8]}@oidc.local",
        full_name=full_name,
        oidc_subject=subject,
    )
    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
        logger.info("Auto-provisioned user %s for OIDC subject %s", email, subject)
    except IntegrityError:
        db.rollback()
        user = db.scalar(select(User).where(User.oidc_subject == subject))
        if user is None:
            raise
        new_user = user

    return new_user
