from fastapi.testclient import TestClient


def test_liveness_and_health_endpoints(client: TestClient) -> None:
    liveness_response = client.get("/api/v1/health/liveness")
    assert liveness_response.status_code == 200
    assert liveness_response.json()["status"] == "alive"

    health_response = client.get("/api/v1/health")
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

    readiness_response = client.get("/api/v1/health/readiness")
    assert readiness_response.status_code == 200
    assert readiness_response.json()["status"] == "ready"


def test_readiness_endpoint_returns_not_ready_with_db_down(client: TestClient, monkeypatch) -> None:
    from app.api.routes import health

    class BrokenEngine:
        def connect(self):
            raise RuntimeError("database unavailable")

    monkeypatch.setattr(health, "engine", BrokenEngine())

    readiness_response = client.get("/api/v1/health/readiness")
    assert readiness_response.status_code == 503
    assert readiness_response.json()["status"] == "not_ready"


def test_request_id_header_present(client: TestClient) -> None:
    response = client.get("/api/v1/health/liveness")
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")


def test_metrics_requires_secret(client: TestClient) -> None:
    from app.core.config import settings

    # When no secret is configured the endpoint is always forbidden (fail-closed).
    response = client.get("/api/v1/metrics")
    assert response.status_code == 403
    if settings.metrics_secret is not None:
        authed = client.get("/api/v1/metrics", headers={"X-Metrics-Secret": settings.metrics_secret})
        assert authed.status_code == 200
        assert "request_total" in authed.json()
