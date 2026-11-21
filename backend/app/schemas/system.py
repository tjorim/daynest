"""Response bodies of the unauthenticated system endpoints (health, metrics, meta, root)."""

from typing import Literal

from app.schemas.base import ResponseModel


class LivenessResponse(ResponseModel):
    """Process-level alive signal; never touches a dependency."""

    status: Literal["alive"]


class ReadinessResponse(ResponseModel):
    """Result of the dependency checks, sent with HTTP 200 (``ready``) or 503 (``not_ready``)."""

    status: Literal["ready", "not_ready"]


class HealthResponse(ResponseModel):
    """Summary with the two probe paths: the same shape in every app (``status``, ``version``, ``commit``, probes)."""

    status: Literal["ok"]
    version: str
    commit: str
    # Kept for clients that read the old summary; ``liveness_endpoint`` replaces it.
    liveness: Literal["alive"]
    liveness_endpoint: str
    readiness_endpoint: str


class MetricsResponse(ResponseModel):
    uptime_seconds: float
    request_total: int
    error_total: int
    request_rate_per_second: float
    error_rate: float
    latency_avg_ms: float
    latency_max_ms: float


class MetaResponse(ResponseModel):
    name: str
    version: str


class RootResponse(ResponseModel):
    name: str
    message: str
    liveness: str
    readiness: str
    metrics: str
    ha_summary: str
    mcp: str
    mcp_capabilities: str
