from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from hmac import digest

import jwt
from anyio import from_thread
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.auth import AuthorizationPrincipal, AuthType
from app.core.config import settings
from app.core.oidc import (
    OIDCTokenError,
    _extract_roles,
    decode_oidc_token,
    get_or_create_local_user,
)
from app.db.session import get_db
from app.models.integration_client import IntegrationClient
from app.models.user import User

_INTEGRATION_JWT_ISSUER = "daynest-integration"
INTEGRATION_KEY_PREFIX = "daynest_"


def _hash_integration_key_with_secret(raw_key: str, secret: str) -> str:
    # Integration keys are server-generated, high-entropy random tokens (128+ bits),
    # not user-chosen passwords. HMAC-SHA256 with a server-side secret is the correct
    # primitive: brute-force is infeasible at this entropy regardless of hash speed.
    # CodeQL py/weak-sensitive-data-hashing does not apply here.
    return digest(  # lgtm[py/weak-sensitive-data-hashing]
        secret.encode("utf-8"),
        raw_key.encode("utf-8"),
        "sha256",
    ).hex()


def hash_integration_key(raw_key: str) -> str:
    return _hash_integration_key_with_secret(
        raw_key, settings.resolved_integration_key_hash_secret
    )


def get_integration_client_by_raw_key(
    db: Session, raw_key: str
) -> IntegrationClient | None:
    current_hash = hash_integration_key(raw_key)
    hashes = [current_hash]
    previous = (settings.integration_key_hash_secret_previous or "").strip()
    if previous:
        hashes.append(_hash_integration_key_with_secret(raw_key, previous))
    client = db.scalar(
        select(IntegrationClient)
        .where(IntegrationClient.key_hash.in_(hashes))
        .options(joinedload(IntegrationClient.user))
    )
    if (
        client is not None
        and client.is_active
        and client.revoked_at is None
        and client.user is not None
        and client.user.is_active
        and client.key_hash != current_hash
    ):
        client.key_hash = current_hash
        db.commit()
        db.refresh(client)
    return client


def get_integration_client_by_token_hash(
    db: Session, token_hash: str
) -> IntegrationClient | None:
    stmt = (
        select(IntegrationClient)
        .where(IntegrationClient.key_hash == token_hash)
        .options(joinedload(IntegrationClient.user))
    )
    return db.scalar(stmt)


def enforce_integration_rate_limit(db: Session, client: IntegrationClient) -> None:
    """Enforce one fixed window transactionally across every app worker."""
    locked = db.scalar(
        select(IntegrationClient)
        .where(IntegrationClient.id == client.id)
        .with_for_update()
    )
    if locked is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Integration client not found",
        )
    now = datetime.now(UTC)
    started = locked.rate_limit_window_started_at
    if started is not None and started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    if started is None or now - started >= timedelta(minutes=1):
        locked.rate_limit_window_started_at = now
        locked.rate_limit_window_count = 1
    elif locked.rate_limit_window_count >= locked.rate_limit_per_minute:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Integration rate limit exceeded",
        )
    else:
        locked.rate_limit_window_count += 1


def record_integration_client_use(db: Session, client: IntegrationClient) -> None:
    """Persist useful last-used metadata without writing on every request."""
    now = datetime.now(UTC)
    last_used_at = client.last_used_at
    if last_used_at is not None and last_used_at.tzinfo is None:
        last_used_at = last_used_at.replace(tzinfo=UTC)
    if last_used_at is not None and now - last_used_at < timedelta(minutes=1):
        db.commit()
        return
    client.last_used_at = now
    db.commit()


def has_required_scopes(granted: set[str], required: frozenset[str]) -> bool:
    if "integration:*" in granted:
        return True
    for scope in required:
        namespace = scope.partition(":")[0]
        if scope not in granted and f"{namespace}:*" not in granted:
            return False
    return True


def require_integration_auth(*required_scopes: str) -> Callable:
    required = frozenset(required_scopes)

    def dependency(
        request: Request,
        authorization: str | None = Header(default=None, alias="Authorization"),
        x_integration_key: str | None = Header(default=None, alias="X-Integration-Key"),
        db: Session = Depends(get_db),
    ) -> User:
        # JWT path: Bearer token with three segments (two dots)
        if authorization and authorization.lower().startswith("bearer "):
            raw_token = authorization[len("bearer ") :].strip()
            if raw_token.count(".") == 2:
                # Integration JWT path (HS256, issued by this server's token endpoint)
                try:
                    int_claims = jwt.decode(
                        raw_token,
                        settings.resolved_integration_key_hash_secret,
                        algorithms=["HS256"],
                        issuer=_INTEGRATION_JWT_ISSUER,
                        options={"require": ["exp", "iss", "sub"]},
                    )
                    try:
                        client_id_int = int(int_claims["sub"])
                    except (ValueError, KeyError):
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid integration token",
                        )
                    int_client = db.scalar(
                        select(IntegrationClient)
                        .where(IntegrationClient.id == client_id_int)
                        .options(joinedload(IntegrationClient.user))
                    )
                    if (
                        int_client is None
                        or not int_client.is_active
                        or int_client.revoked_at is not None
                    ):
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Integration client not found or inactive",
                        )
                    if int_client.user is None:
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Integration owner not found",
                        )
                    granted = set(int_client.scopes)
                    if not has_required_scopes(granted, required):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Integration token lacks required scope",
                        )
                    request.state.user_id = int_client.user.id
                    request.state.auth_type = AuthType.INTEGRATION
                    request.state.principal = AuthorizationPrincipal(
                        subject=f"integration:{int_client.id}",
                        user_id=int_client.user.id,
                        client_id=str(int_client.id),
                        auth_type=AuthType.INTEGRATION,
                        scopes=frozenset(granted),
                    )
                    enforce_integration_rate_limit(db, int_client)
                    record_integration_client_use(db, int_client)
                    return int_client.user
                except jwt.ExpiredSignatureError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Integration token has expired",
                    ) from exc
                except jwt.InvalidIssuerError:
                    pass  # Not an integration JWT — fall through to OIDC
                except jwt.PyJWTError:
                    pass  # Not a valid integration JWT — fall through to OIDC

                # OIDC path
                try:
                    claims = from_thread.run(decode_oidc_token, raw_token)
                except OIDCTokenError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or expired OIDC token",
                    ) from exc
                subject = claims.get("sub")
                if not subject:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="OIDC token missing sub claim",
                    )
                user = get_or_create_local_user(subject, claims, db)
                if not user.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User account is inactive",
                    )
                granted = set(str(claims.get("scope", "")).split())
                if not has_required_scopes(granted, required):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="OIDC token lacks required scope",
                    )
                request.state.user_id = user.id
                request.state.roles = _extract_roles(claims)
                request.state.auth_type = AuthType.KEYCLOAK_USER
                request.state.principal = AuthorizationPrincipal(
                    subject=str(subject),
                    user_id=user.id,
                    client_id=claims.get("azp")
                    if isinstance(claims.get("azp"), str)
                    else None,
                    auth_type=AuthType.KEYCLOAK_USER,
                    roles=frozenset(_extract_roles(claims)),
                    scopes=frozenset(granted),
                )
                return user

        # Integration key path
        raw_key: str | None = None
        if authorization and authorization.lower().startswith("bearer "):
            raw_key = authorization[len("bearer ") :].strip()
        elif x_integration_key:
            raw_key = x_integration_key

        if not raw_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Integration key required",
            )

        client = get_integration_client_by_raw_key(db, raw_key)
        if client is None or not client.is_active or client.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid integration key",
            )

        if client.user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Integration owner not found",
            )
        granted = set(client.scopes)
        if not has_required_scopes(granted, required):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Integration key lacks required scope",
            )

        request.state.user_id = client.user.id
        request.state.auth_type = AuthType.INTEGRATION
        request.state.principal = AuthorizationPrincipal(
            subject=f"integration:{client.id}",
            user_id=client.user.id,
            client_id=str(client.id),
            auth_type=AuthType.INTEGRATION,
            scopes=frozenset(granted),
        )
        enforce_integration_rate_limit(db, client)
        record_integration_client_use(db, client)
        return client.user

    return dependency
