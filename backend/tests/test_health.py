"""Health endpoints share one shape across the apps: liveness, readiness and the summary with both probe paths."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.routers import health


@pytest.fixture
def sqlite_engine(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", poolclass=StaticPool)
    monkeypatch.setattr(health, "engine", engine)
    monkeypatch.setattr(health.settings, "oidc_issuer_url", None)
    return engine


def test_liveness_never_touches_a_dependency(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def broken() -> None:
        raise AssertionError("liveness must not check the database")

    monkeypatch.setattr(health, "_check_db", broken)

    response = client.get("/api/health/liveness")

    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


@pytest.mark.usefixtures("sqlite_engine")
def test_readiness_is_ready_on_a_reachable_database(client: TestClient) -> None:
    response = client.get("/api/health/readiness")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_readiness_is_not_ready_with_503_when_the_database_fails(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def down() -> None:
        raise RuntimeError("postgresql://user:password@db/daynest")

    monkeypatch.setattr(health, "_check_db", down)

    response = client.get("/api/health/readiness")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready"}
    assert "password" not in response.text


def test_readiness_is_not_ready_when_the_oidc_keys_are_unreachable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, sqlite_engine
) -> None:
    async def unreachable() -> bool:
        return False

    monkeypatch.setattr(health.settings, "oidc_issuer_url", "https://idp.example")
    monkeypatch.setattr(health, "_jwks_readiness_cache", None)
    monkeypatch.setattr(health, "check_jwks_reachable", unreachable)

    response = client.get("/api/health/readiness")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready"}


def test_summary_names_both_probe_paths_and_answers_without_the_database(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] and body["commit"]
    assert client.get(body["liveness_endpoint"]).status_code == 200
    assert body["liveness_endpoint"] == "/api/health/liveness"
    assert body["readiness_endpoint"] == "/api/health/readiness"
