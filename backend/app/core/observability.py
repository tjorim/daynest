from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass
from threading import Lock

import sentry_sdk
from fastapi import Request
from sentry_sdk.integrations.fastapi import FastApiIntegration

from app.core.config import settings

logger = logging.getLogger("app.observability")


@dataclass
class MetricsSnapshot:
    uptime_seconds: float
    total_requests: int
    total_errors: int
    request_rate_per_second: float
    error_rate: float
    latency_avg_ms: float
    latency_max_ms: float


class InMemoryRequestMetrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._started_at = time.monotonic()
        self._total_requests = 0
        self._total_errors = 0
        self._latency_sum_ms = 0.0
        self._latency_max_ms = 0.0

    def record(self, *, status_code: int, latency_ms: float) -> None:
        with self._lock:
            self._total_requests += 1
            if status_code >= 500:
                self._total_errors += 1
            self._latency_sum_ms += latency_ms
            self._latency_max_ms = max(self._latency_max_ms, latency_ms)

    def snapshot(self) -> MetricsSnapshot:
        with self._lock:
            uptime_seconds = max(time.monotonic() - self._started_at, 1e-9)
            total_requests = self._total_requests
            total_errors = self._total_errors
            latency_avg_ms = self._latency_sum_ms / total_requests if total_requests else 0.0
            return MetricsSnapshot(
                uptime_seconds=uptime_seconds,
                total_requests=total_requests,
                total_errors=total_errors,
                request_rate_per_second=total_requests / uptime_seconds,
                error_rate=total_errors / total_requests if total_requests else 0.0,
                latency_avg_ms=latency_avg_ms,
                latency_max_ms=self._latency_max_ms,
            )


metrics = InMemoryRequestMetrics()


def configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    app_logger = logging.getLogger("app")
    app_logger.setLevel(level)
    if not app_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        app_logger.addHandler(handler)


def configure_error_tracking() -> None:
    if not settings.sentry_dsn:
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[FastApiIntegration()],
    )


async def observability_middleware(request: Request, call_next):
    started = time.perf_counter()
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id

    status_code = 500
    response = None
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        latency_ms = (time.perf_counter() - started) * 1000
        metrics.record(status_code=status_code, latency_ms=latency_ms)

        if logger.isEnabledFor(logging.INFO):
            user_id = getattr(request.state, "user_id", None)
            log_payload = {
                "event": "http_request",
                "request_id": request_id,
                "user_id": user_id,
                "method": request.method,
                "route": request.url.path,
                "status_code": status_code,
                "latency_ms": round(latency_ms, 2),
            }
            log = logger.error if status_code >= 500 else logger.warning if status_code >= 400 else logger.info
            log(json.dumps(log_payload, separators=(",", ":")))

        if response is not None:
            response.headers["X-Request-ID"] = request_id
