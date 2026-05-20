import threading
from collections import defaultdict, deque
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from hmac import digest

import jwt
from anyio import from_thread
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.oidc import OIDCTokenError, decode_oidc_token, get_or_create_local_user
from app.db.session import get_db
from app.models.integration_client import IntegrationClient
from app.models.user import User

_INTEGRATION_JWT_ISSUER = "daynest-integration"

# In-process only: does not work correctly with multiple Uvicorn/Gunicorn workers.
# Replace with a distributed store (e.g. Redis) before scaling beyond a single process.
_request_log: dict[int, deque[datetime]] = defaultdict(deque)
_request_log_lock = threading.Lock()


def hash_integration_key(raw_key: str) -> str:
    # Integration keys are server-generated, high-entropy random tokens (128+ bits),
    # not user-chosen passwords. HMAC-SHA256 with a server-side secret is the correct
    # primitive: brute-force is infeasible at this entropy regardless of hash speed.
    # CodeQL py/weak-sensitive-data-hashing does not apply here.
    return digest(  # lgtm[py/weak-sensitive-data-hashing]
        settings.resolved_integration_key_hash_secret.encode("utf-8"),
        raw_key.encode("utf-8"),
        "sha256",
    ).hex()


def get_integration_client_by_token_hash(db: Session, token_hash: str) -> IntegrationClient | None:
    stmt = select(IntegrationClient).where(IntegrationClient.key_hash == token_hash).options(joinedload(IntegrationClient.user))
    return db.scalar(stmt)


def ensure_integration_scope(client: IntegrationClient, scope: str) -> None:
    scopes = {item.strip() for item in client.scopes_csv.split(",") if item.strip()}
    if scope not in scopes:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing scope: {scope}")


def enforce_integration_rate_limit(client: IntegrationClient) -> None:
    with _request_log_lock:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=1)
        bucket = _request_log[client.id]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= client.rate_limit_per_minute:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Integration rate limit exceeded")
        bucket.append(now)


def require_integration_scope(scope: str) -> Callable:
    def dependency(
        authorization: str | None = Header(default=None, alias="Authorization"),
        x_integration_key: str | None = Header(default=None, alias="X-Integration-Key"),
        db: Session = Depends(get_db),
    ) -> User:
        # JWT path: Bearer token with three segments (two dots)
        if authorization and authorization.lower().startswith("bearer "):
            raw_token = authorization[len("bearer "):].strip()
            if raw_token.count(".") == 2:
                # Integration JWT path (HS256, issued by this server's token endpoint)
                try:
                    int_claims = jwt.decode(
                        raw_token,
                        settings.resolved_integration_key_hash_secret,
                        algorithms=["HS256"],
                        issuer=_INTEGRATION_JWT_ISSUER,
                        options={"require": ["exp", "iss", "sub", "scope"]},
                    )
                    token_scopes = set(int_claims.get("scope", "").split())
                    if scope not in token_scopes:
                        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing scope: {scope}")
                    try:
                        client_id_int = int(int_claims["sub"])
                    except (ValueError, KeyError):
                        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid integration token")
                    int_client = db.scalar(
                        select(IntegrationClient).where(IntegrationClient.id == client_id_int).options(joinedload(IntegrationClient.user))
                    )
                    if int_client is None or not int_client.is_active:
                        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Integration client not found or inactive")
                    enforce_integration_rate_limit(int_client)
                    if int_client.user is None:
                        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Integration owner not found")
                    return int_client.user
                except jwt.ExpiredSignatureError as exc:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Integration token has expired") from exc
                except jwt.InvalidIssuerError:
                    pass  # Not an integration JWT — fall through to OIDC
                except jwt.PyJWTError:
                    pass  # Not a valid integration JWT — fall through to OIDC

                # OIDC path
                try:
                    claims = from_thread.run(decode_oidc_token, raw_token)
                except OIDCTokenError as exc:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OIDC token") from exc
                token_scopes = set(claims.get("scope", "").split())
                if scope not in token_scopes:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing scope: {scope}")
                subject = claims.get("sub")
                if not subject:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OIDC token missing sub claim")
                user = get_or_create_local_user(subject, claims, db)
                if not user.is_active:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive")
                return user

        # Integration key path
        raw_key: str | None = None
        if authorization and authorization.lower().startswith("bearer "):
            raw_key = authorization[len("bearer "):].strip()
        elif x_integration_key:
            raw_key = x_integration_key

        if not raw_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Integration key required")

        token_hash = hash_integration_key(raw_key)
        client = get_integration_client_by_token_hash(db, token_hash)
        if client is None or not client.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid integration key")

        ensure_integration_scope(client, scope)

        if client.user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Integration owner not found")

        enforce_integration_rate_limit(client)

        return client.user

    return dependency
