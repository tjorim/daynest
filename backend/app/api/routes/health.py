import asyncio
import hashlib
import hmac
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.observability import metrics
from app.core.oidc import check_jwks_reachable
from app.db.session import engine
from app.middleware.rate_limit import limiter

logger = logging.getLogger("app.health")

router = APIRouter(tags=["system"])

_METRICS_TOKEN_MAX_AGE_SECONDS = 60


def _verify_metrics_token(token: str, secret: str) -> bool:
    """Verify an HMAC metrics token of the form ``<timestamp>:<hex-signature>``.

    The signature is HMAC-SHA256(secret, timestamp); tokens older than
    _METRICS_TOKEN_MAX_AGE_SECONDS or timestamped in the future are rejected.
    """
    try:
        ts_str, provided_sig = token.split(":", 1)
        ts = int(ts_str)
    except (ValueError, AttributeError):
        return False

    now = int(time.time())
    if ts > now or now - ts > _METRICS_TOKEN_MAX_AGE_SECONDS:
        return False

    expected_sig = hmac.new(secret.encode(), ts_str.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_sig, provided_sig)


def _require_metrics_access(request: Request) -> None:
    secret = settings.metrics_hmac_secret
    if not secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    provided = request.headers.get("X-Metrics-Token", "")
    if not provided or not _verify_metrics_token(provided, secret):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/health/liveness")
@limiter.exempt
def liveness_check() -> dict[str, str]:
    return {"status": "alive"}


def _check_db() -> None:
    with engine.connect() as connection:
        connection.execute(text("SET LOCAL statement_timeout = '2000'"))
        connection.execute(text("SELECT 1"))


# Readiness probes are typically polled every few seconds; caching a successful
# reachability result avoids hammering the OIDC provider on every probe. Failures
# are not cached, so recovery is picked up on the very next probe instead of
# staying "not_ready" for the rest of the cache window.
_JWKS_READINESS_CACHE_SECONDS = 30.0
_jwks_readiness_cache: tuple[float, bool] | None = None
_jwks_readiness_lock = asyncio.Lock()


async def _jwks_reachable() -> bool:
    global _jwks_readiness_cache  # noqa: PLW0603
    now = time.monotonic()
    if _jwks_readiness_cache is not None and now - _jwks_readiness_cache[0] < _JWKS_READINESS_CACHE_SECONDS:
        return _jwks_readiness_cache[1]

    async with _jwks_readiness_lock:
        now = time.monotonic()
        if _jwks_readiness_cache is not None and now - _jwks_readiness_cache[0] < _JWKS_READINESS_CACHE_SECONDS:
            return _jwks_readiness_cache[1]

        reachable = await check_jwks_reachable()
        _jwks_readiness_cache = (now, True) if reachable else None
        return reachable


@router.get("/health/readiness")
@limiter.exempt
async def readiness_check(response: Response) -> dict[str, str]:
    try:
        await asyncio.to_thread(_check_db)
    except (SQLAlchemyError, OSError, RuntimeError):
        logger.exception("Readiness check failed: database connectivity error")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready"}

    if settings.oidc_issuer_url and not await _jwks_reachable():
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready"}

    return {"status": "ready"}


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "liveness": "alive", "readiness_endpoint": "/health/readiness"}


@router.get("/metrics")
def metrics_endpoint(_: None = Depends(_require_metrics_access)) -> dict[str, float | int]:
    snapshot = metrics.snapshot()
    return {
        "uptime_seconds": round(snapshot.uptime_seconds, 2),
        "request_total": snapshot.total_requests,
        "error_total": snapshot.total_errors,
        "request_rate_per_second": round(snapshot.request_rate_per_second, 4),
        "error_rate": round(snapshot.error_rate, 4),
        "latency_avg_ms": round(snapshot.latency_avg_ms, 2),
        "latency_max_ms": round(snapshot.latency_max_ms, 2),
    }


@router.get("/meta")
def meta() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.version,
    }
