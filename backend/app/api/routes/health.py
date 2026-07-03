import asyncio
import hmac
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.observability import metrics
from app.core.oidc import OIDCTokenError, _http_client, _resolve_jwks_uri
from app.db.session import engine

logger = logging.getLogger("app.health")

router = APIRouter(tags=["system"])


def _require_metrics_access(request: Request) -> None:
    secret = settings.metrics_secret
    if not secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    provided = request.headers.get("X-Metrics-Secret", "")
    if not hmac.compare_digest(provided, secret):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/health/liveness")
def liveness_check() -> dict[str, str]:
    return {"status": "alive"}


def _check_db() -> None:
    with engine.connect() as connection:
        connection.execute(text("SET LOCAL statement_timeout = '2000'"))
        connection.execute(text("SELECT 1"))


# Readiness probes are typically polled every few seconds; caching the JWKS
# reachability result avoids hammering the OIDC provider on every probe and
# risking rate-limiting or cascading failures if it's briefly slow.
_JWKS_READINESS_CACHE_SECONDS = 30.0
_jwks_readiness_cache: tuple[float, bool] | None = None


async def _jwks_reachable() -> bool:
    global _jwks_readiness_cache  # noqa: PLW0603
    now = time.monotonic()
    if _jwks_readiness_cache is not None and now - _jwks_readiness_cache[0] < _JWKS_READINESS_CACHE_SECONDS:
        return _jwks_readiness_cache[1]

    reachable = True
    try:
        jwks_uri = await _resolve_jwks_uri()
        response = await _http_client.get(jwks_uri)
        response.raise_for_status()
    except OIDCTokenError:
        logger.exception("Readiness check failed: OIDC discovery failed")
        reachable = False
    except Exception:
        logger.exception("Readiness check failed: OIDC JWKS endpoint unreachable")
        reachable = False

    _jwks_readiness_cache = (now, reachable)
    return reachable


@router.get("/health/readiness")
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
