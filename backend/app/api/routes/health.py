import logging

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.config import settings
from app.core.observability import metrics
from app.db.session import engine

logger = logging.getLogger("app.health")

router = APIRouter(tags=["system"])


@router.get("/health/liveness")
def liveness_check() -> dict[str, str]:
    return {"status": "alive"}


@router.get("/health/readiness")
def readiness_check(response: Response) -> dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Readiness check failed: database connectivity error")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready"}

    return {"status": "ready"}


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "liveness": "alive", "readiness": "use /health/readiness"}


@router.get("/metrics")
def metrics_endpoint() -> dict[str, float | int]:
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
