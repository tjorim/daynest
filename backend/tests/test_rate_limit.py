"""Tests for the per-client-IP rate limiting dependency (app.middleware.rate_limit)."""

from __future__ import annotations

import re

import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.middleware.rate_limit import (
    RateLimitExceeded,
    RequestRateLimiter,
    exempt_paths,
    get_client_ip,
    handle_rate_limit_exceeded,
    rate_limit,
)


def _build_app(*, limit: str = "2/minute", enabled: bool = True) -> FastAPI:
    """Build a throwaway app wired the same way as the real one, but with a tiny limit."""
    limiter = RequestRateLimiter(limit, enabled=enabled)
    app = FastAPI(dependencies=[Depends(rate_limit)])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, handle_rate_limit_exceeded)

    @app.get("/ping")
    async def ping():
        return {"ok": True}

    @app.get("/api/health/liveness")
    async def health():
        return {"ok": True}

    router = APIRouter()

    @router.get("/items/{item_id}")
    async def item(item_id: int):
        return {"id": item_id}

    nested = APIRouter()
    nested.include_router(router, prefix="/nested")
    app.include_router(nested, prefix="/api")
    app.include_router(router, prefix="/other")

    mounted = FastAPI()

    @mounted.get("/ping")
    async def mounted_ping():
        return {"ok": True}

    app.mount("/mcp", mounted)
    return app


def test_requests_within_limit_succeed():
    client = TestClient(_build_app())
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 200


def test_requests_over_limit_are_rejected_with_429():
    client = TestClient(_build_app())
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 200

    response = client.get("/ping")

    assert response.status_code == 429
    assert "Rate limit exceeded" in response.json()["error"]


def test_exempt_route_is_never_limited():
    client = TestClient(_build_app())
    for _ in range(5):
        assert client.get("/api/health/liveness").status_code == 200


def test_disabled_limiter_never_rejects():
    client = TestClient(_build_app(enabled=False))
    for _ in range(5):
        assert client.get("/ping").status_code == 200


def test_different_client_ips_get_independent_buckets():
    # TestClient's default simulated peer is the string "testclient", not an
    # IP, so it would never pass the trusted-proxy check on its own. Pin it
    # to a private address to simulate "arrived via Caddy" and vary
    # X-Real-IP per request to simulate different real clients behind it.
    client = TestClient(_build_app(), client=("172.20.0.2", 12345))
    assert client.get("/ping", headers={"X-Real-IP": "1.1.1.1"}).status_code == 200
    assert client.get("/ping", headers={"X-Real-IP": "1.1.1.1"}).status_code == 200
    assert client.get("/ping", headers={"X-Real-IP": "1.1.1.1"}).status_code == 429

    # A different client IP draws from its own, untouched bucket.
    assert client.get("/ping", headers={"X-Real-IP": "2.2.2.2"}).status_code == 200


def test_get_client_ip_prefers_x_real_ip_header():
    """Behind Caddy, request.client.host is Caddy's own address, not the real client's."""
    scope = {
        "type": "http",
        "headers": [(b"x-real-ip", b"9.9.9.9")],
        "client": ("127.0.0.1", 12345),
    }
    request = Request(scope)

    assert get_client_ip(request) == "9.9.9.9"


def test_get_client_ip_falls_back_to_request_client():
    scope = {"type": "http", "headers": [], "client": ("10.0.0.5", 12345)}
    request = Request(scope)

    assert get_client_ip(request) == "10.0.0.5"


def test_get_client_ip_ignores_x_real_ip_from_untrusted_public_peer():
    """A caller reaching the app directly (bypassing Caddy) can't spoof X-Real-IP.

    If the request didn't come from a private-network peer, the header is
    attacker-controlled — trusting it would let a single caller draw a fresh
    rate-limit bucket on every request by varying the header value.
    """
    scope = {
        "type": "http",
        "headers": [(b"x-real-ip", b"9.9.9.9")],
        "client": ("8.8.8.8", 12345),
    }
    request = Request(scope)

    assert get_client_ip(request) == "8.8.8.8"


def test_nested_included_router_is_limited_by_template():
    client = TestClient(_build_app())
    assert client.get("/api/nested/items/1").status_code == 200
    assert client.get("/api/nested/items/2").status_code == 200
    response = client.get("/api/nested/items/3")
    assert response.status_code == 429
    assert response.json() == {"error": "Rate limit exceeded: 2 per 1 minute"}
    assert 1 <= int(response.headers["Retry-After"]) <= 60
    assert response.headers["X-RateLimit-Limit"] == "2"
    assert response.headers["X-RateLimit-Remaining"] == "0"
    assert "X-RateLimit-Reset" in response.headers
    # Other routes, including the same router included at a second prefix, have their own buckets.
    assert client.get("/other/items/1").status_code == 200
    assert client.get("/ping").status_code == 200


def test_mounted_mcp_is_outside_rest_limit():
    client = TestClient(_build_app())
    for _ in range(5):
        assert client.get("/mcp/ping").status_code == 200


def test_real_health_probes_stay_exempt(monkeypatch):
    from app.api.routes import health
    from app.main import app

    monkeypatch.setattr(app.state, "limiter", RequestRateLimiter("1/minute"))
    monkeypatch.setattr(health, "_check_db", lambda: None)
    monkeypatch.setattr(health.settings, "oidc_issuer_url", None)
    client = TestClient(app, base_url="http://localhost")
    for path in exempt_paths():
        for _ in range(3):
            assert client.get(path).status_code == 200


def _openapi_operations():
    from app.main import app

    for path, operations in app.openapi()["paths"].items():
        if path not in exempt_paths():
            for method in operations:
                if method in {"get", "post", "put", "patch", "delete", "options", "head", "trace"}:
                    yield method, path


@pytest.mark.parametrize("method,template", list(_openapi_operations()))
def test_every_openapi_operation_enforces_default_limit(monkeypatch, method, template):
    """Exhaust each actual operation's bucket before dispatch, avoiding handler side effects.

    Requests must reach the real global dependency before auth, validation or DB
    work. Dropping it from any route causes a non-429 response and fails this test.
    """
    from app.main import app

    limiter = RequestRateLimiter("1/minute")
    monkeypatch.setattr(app.state, "limiter", limiter)
    assert limiter.strategy.hit(limiter.limits[0], "testclient", template)
    path = re.sub(r"\{[^}]+\}", "1", template)
    client = TestClient(app, base_url="http://localhost")
    response = client.request(method, path)
    assert response.status_code == 429, (method, template, response.text)
    assert response.json() == {"error": "Rate limit exceeded: 1 per 1 minute"}
    assert response.headers["X-Request-ID"]
