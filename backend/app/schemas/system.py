"""Response bodies of the unauthenticated system endpoints (health, metrics, meta, root)."""

from typing import Literal

from pydantic import BaseModel


class LivenessResponse(BaseModel):
    status: Literal["alive"]


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    commit: str
    liveness: Literal["alive"]
    readiness_endpoint: str


class MetricsResponse(BaseModel):
    uptime_seconds: float
    request_total: int
    error_total: int
    request_rate_per_second: float
    error_rate: float
    latency_avg_ms: float
    latency_max_ms: float


class MetaResponse(BaseModel):
    name: str
    version: str


class RootResponse(BaseModel):
    name: str
    message: str
    liveness: str
    readiness: str
    metrics: str
    ha_summary: str
    mcp: str
    mcp_capabilities: str
