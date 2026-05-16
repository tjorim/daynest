"""OIDC/JWT authentication for Daynest backend.

Validates Bearer JWTs issued by Keycloak and auto-provisions local user records
on first login.

Configuration via AppSettings:
  OIDC_ISSUER_URL   — Keycloak realm URL (e.g. http://localhost:8080/realms/daynest)
  OIDC_AUDIENCE     — Expected audience claim (optional)
  OIDC_JWKS_URI     — JWKS endpoint override (defaults to {issuer}/protocol/openid-connect/certs)
  OIDC_ALGORITHMS   — Comma-separated accepted algorithms (default RS256)

Token subject claim (``sub``) is the stable identity key.
On first login, existing users are linked by email to support migration from local auth.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
import jwt
from jwt.exceptions import ExpiredSignatureError, PyJWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

_OIDC_ALGORITHMS: list[str] = [a.strip() for a in settings.oidc_algorithms.split(",") if a.strip()]
_OIDC_AUDIENCE: str | None = settings.oidc_audience or None
_OIDC_ISSUER: str | None = settings.oidc_issuer_url or None

_jwks_lock = asyncio.Lock()
_jwks_cache: dict[str, Any] | None = None


def _get_jwks_uri() -> str:
    if settings.oidc_jwks_uri:
        return settings.oidc_jwks_uri
    base = (settings.oidc_issuer_url or "").rstrip("/")
    return f"{base}/protocol/openid-connect/certs"


async def _fetch_jwks() -> dict[str, Any]:
    uri = _get_jwks_uri()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(uri)
        response.raise_for_status()
        result: dict[str, Any] = response.json()
        return result
    except Exception as exc:
        logger.error("Failed to fetch JWKS from %s: %s", uri, exc)
        raise


async def _get_jwks(*, force_refresh: bool = False) -> dict[str, Any]:
    global _jwks_cache  # noqa: PLW0603
    async with _jwks_lock:
        if _jwks_cache is None or force_refresh:
            _jwks_cache = await _fetch_jwks()
        return _jwks_cache


class OIDCTokenError(Exception):
    """Raised when a JWT cannot be validated against the OIDC provider."""


def _find_signing_key(jwks_dict: dict[str, Any], kid: str | None) -> Any | None:
    from jwt import PyJWKSet

    jwks_set = PyJWKSet.from_dict(jwks_dict)
    return next(
        (k for k in jwks_set.keys if kid is None or k.key_id == kid),
        None,
    )


async def decode_oidc_token(token: str) -> dict[str, Any]:
    """Decode and validate a Keycloak-issued JWT.

    Tries cached JWKS first; refreshes once on key-not-found to handle rotation.
    """
    options: dict[str, bool] = {
        "verify_aud": _OIDC_AUDIENCE is not None,
        "verify_iss": _OIDC_ISSUER is not None,
    }

    for attempt in range(2):
        try:
            jwks_dict = await _get_jwks(force_refresh=(attempt == 1))
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            signing_key = _find_signing_key(jwks_dict, kid)

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
        email=email or f"user-{subject[:8]}@keycloak.local",
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
