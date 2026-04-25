from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import settings


def _encode_token(payload: dict[str, Any], expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        **payload,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(claims, settings.resolved_jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int, email: str) -> str:
    return _encode_token(
        {"sub": str(user_id), "email": email, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: int, email: str) -> str:
    return _encode_token(
        {"sub": str(user_id), "email": email, "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.resolved_jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["exp", "iat", "sub"]},
    )
