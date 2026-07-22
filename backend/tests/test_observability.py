import hashlib
import hmac
import json
import logging
import time
import uuid

from fastapi.testclient import TestClient
import pytest


def test_liveness_and_health_endpoints(client: TestClient) -> None:
    liveness_response = client.get("/api/health/liveness")
    assert liveness_response.status_code == 200
    assert liveness_response.json()["status"] == "alive"

    health_response = client.get("/api/health")
    assert health_response.status_code == 200
    payload = health_response.json()
    assert payload["status"] == "ok"
    assert payload["liveness"] == "alive"
    assert "readiness_endpoint" in payload


def test_readiness_endpoint_returns_ready(client: TestClient, monkeypatch) -> None:
    from app.api.routes import health

    class HealthyConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return None

        def execute(self, statement):
            return None

    class HealthyEngine:
        def connect(self):
            return HealthyConnection()

    monkeypatch.setattr(health, "engine", HealthyEngine())

    readiness_response = client.get("/api/health/readiness")
    assert readiness_response.status_code == 200
    assert readiness_response.json()["status"] == "ready"


def test_readiness_endpoint_returns_not_ready_with_db_down(client: TestClient, monkeypatch) -> None:
    from app.api.routes import health

    class BrokenEngine:
        def connect(self):
            raise RuntimeError("database unavailable")

    monkeypatch.setattr(health, "engine", BrokenEngine())

    readiness_response = client.get("/api/health/readiness")
    assert readiness_response.status_code == 503
    assert readiness_response.json()["status"] == "not_ready"


@pytest.mark.anyio
async def test_jwks_reachable_coalesces_concurrent_cache_misses(monkeypatch) -> None:
    from app.api.routes import health

    calls = 0

    async def reachable() -> bool:
        nonlocal calls
        calls += 1
        await health.asyncio.sleep(0)
        return True

    monkeypatch.setattr(health, "_jwks_readiness_cache", None)
    monkeypatch.setattr(health, "check_jwks_reachable", reachable)

    results = await health.asyncio.gather(*(health._jwks_reachable() for _ in range(5)))

    assert results == [True] * 5
    assert calls == 1


def test_request_id_generated_when_absent(client: TestClient) -> None:
    response = client.get("/api/health/liveness")
    assert response.status_code == 200
    request_id = response.headers.get("X-Request-ID")
    assert request_id is not None
    # Generated ID must be a valid UUID4
    parsed = uuid.UUID(request_id, version=4)
    assert str(parsed) == request_id


def test_request_id_propagated_when_supplied(client: TestClient) -> None:
    supplied_id = "my-trace-id-abc123"
    response = client.get("/api/health/liveness", headers={"X-Request-ID": supplied_id})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == supplied_id


def _make_metrics_token(secret: str, ts: int | None = None) -> str:
    ts = int(time.time()) if ts is None else ts
    sig = hmac.new(secret.encode(), str(ts).encode(), hashlib.sha256).hexdigest()
    return f"{ts}:{sig}"


def test_metrics_not_found_when_secret_unset(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "metrics_hmac_secret", None)

    response = client.get("/api/metrics")
    assert response.status_code == 404


def test_metrics_forbidden_with_wrong_secret(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "metrics_hmac_secret", "correct-secret")

    token = _make_metrics_token("wrong-secret")
    response = client.get("/api/metrics", headers={"X-Metrics-Token": token})
    assert response.status_code == 403

    response_no_header = client.get("/api/metrics")
    assert response_no_header.status_code == 403

    authed = client.get("/api/metrics", headers={"X-Metrics-Token": _make_metrics_token("correct-secret")})
    assert authed.status_code == 200
    assert "request_total" in authed.json()


def test_metrics_forbidden_with_expired_token(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    secret = "correct-secret"
    monkeypatch.setattr(settings, "metrics_hmac_secret", secret)

    old_token = _make_metrics_token(secret, ts=int(time.time()) - 120)
    response = client.get("/api/metrics", headers={"X-Metrics-Token": old_token})
    assert response.status_code == 403


def test_metrics_forbidden_with_future_token(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    secret = "correct-secret"
    monkeypatch.setattr(settings, "metrics_hmac_secret", secret)

    future_token = _make_metrics_token(secret, ts=int(time.time()) + 120)
    response = client.get("/api/metrics", headers={"X-Metrics-Token": future_token})
    assert response.status_code == 403


def test_structured_log_payload_shape(client: TestClient, caplog) -> None:
    with caplog.at_level(logging.INFO, logger="app.observability"):
        response = client.get("/api/health/liveness")

    assert response.status_code == 200

    log_records = [r for r in caplog.records if r.name == "app.observability"]
    assert log_records, "Expected at least one structured log record from observability middleware"

    payload = json.loads(log_records[-1].message)
    assert payload["event"] == "http_request"
    assert "request_id" in payload
    assert "user_id" in payload
    assert "auth_type" in payload
    assert payload["method"] == "GET"
    assert payload["route"] == "/api/health/liveness"
    assert payload["status_code"] == 200
    assert "latency_ms" in payload
    assert isinstance(payload["latency_ms"], float)


def test_structured_log_does_not_leak_query_params(client: TestClient, caplog) -> None:
    """Route field must be path-only — query params (e.g. SSE tokens) must not appear."""
    with caplog.at_level(logging.INFO, logger="app.observability"):
        response = client.get("/api/health/liveness?sensitive=secret-token")

    assert response.status_code == 200

    log_records = [r for r in caplog.records if r.name == "app.observability"]
    assert log_records
    payload = json.loads(log_records[-1].message)
    assert "sensitive" not in payload["route"]
    assert "secret-token" not in payload["route"]
