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


def test_readiness_endpoint_returns_ready_or_not_ready(client: TestClient) -> None:
    readiness_response = client.get("/api/v1/health/readiness")
    assert readiness_response.status_code in {200, 503}
    assert readiness_response.json()["status"] in {"ready", "not_ready"}


def test_request_id_header_and_metrics_exposure(client: TestClient) -> None:
    before = client.get("/api/v1/metrics")
    assert before.status_code == 200
    before_total = before.json()["request_total"]

    response = client.get("/api/v1/health/liveness")
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")

    after = client.get("/api/v1/metrics")
    assert after.status_code == 200
    payload = after.json()

    assert payload["request_total"] >= before_total + 1
    assert "request_rate_per_second" in payload
    assert "error_rate" in payload
    assert "latency_avg_ms" in payload
