import threading
from collections import defaultdict, deque
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.integration_client import IntegrationClient
from app.models.user import User

# In-process only: does not work correctly with multiple Uvicorn/Gunicorn workers.
# Replace with a distributed store (e.g. Redis) before scaling beyond a single process.
_request_log: dict[int, deque[datetime]] = defaultdict(deque)
_request_log_lock = threading.Lock()


def hash_integration_key(raw_key: str) -> str:
    return sha256(raw_key.encode("utf-8")).hexdigest()


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
        x_integration_key: str = Header(..., alias="X-Integration-Key"),
        db: Session = Depends(get_db),
    ) -> User:
        token_hash = hash_integration_key(x_integration_key)
        client = get_integration_client_by_token_hash(db, token_hash)
        if client is None or not client.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid integration key")

        ensure_integration_scope(client, scope)

        if client.user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Integration owner not found")

        enforce_integration_rate_limit(client)

        return client.user

    return dependency
