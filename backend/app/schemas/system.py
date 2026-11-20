"""Response bodies of the unauthenticated system endpoints (health, metrics, meta, root)."""

from typing import Literal

from app.schemas.base import ResponseModel


class LivenessResponse(ResponseModel):
    status: Literal["alive"]


class ReadinessResponse(ResponseModel):
    status: Literal["ready", "not_ready"]


class HealthResponse(ResponseModel):
    status: Literal["ok"]
    version: str
    commit: str
    liveness: Literal["alive"]
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
