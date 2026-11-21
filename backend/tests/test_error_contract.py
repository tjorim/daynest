"""Error contract of the assembled app: one body shape, stable codes, no stack traces and no secrets.

``test_api_errors.py`` covers the handler in isolation; these tests go through ``app.main:app`` so a middleware or a
router that changes the shape is caught. Wording of ``detail`` is not part of the contract, ``code`` is.
"""

import logging
from collections.abc import Generator
from types import SimpleNamespace

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.core.errors import handle_unhandled_exception
from app.db.session import get_db
from app.main import app

TRACE_MARKERS = ("Traceback", 'File "', "site-packages", "/app/", "sqlalchemy", "psycopg")


def assert_error_body(body: dict) -> None:
    """Every app-raised failure is ``{"detail": str, "code": str}`` (plus optional safe ``params``)."""
    assert set(body) <= {"detail", "code", "params"}
    assert isinstance(body["detail"], str) and body["detail"]
    assert isinstance(body["code"], str) and body["code"]
    assert isinstance(body.get("params", {}), dict)


def test_app_raised_failures_use_one_shape_with_stable_codes(client: TestClient) -> None:
    expected = [
        (client.get("/api/today"), 401, "not_authenticated"),
        (client.get("/api/metrics"), 404, "not_found"),
    ]
    for response, status, code in expected:
        assert response.status_code == status
        assert response.headers["content-type"] == "application/json"
        body = response.json()
        assert_error_body(body)
        assert body["code"] == code


def test_framework_failures_carry_a_stable_code_next_to_their_detail(client: TestClient) -> None:
    # Unknown paths and wrong methods are answered by Starlette: ``detail`` unchanged, ``code`` added.
    cases = (
        (client.get("/api/does-not-exist"), 404, "not_found"),
        (client.delete("/api/health"), 405, "method_not_allowed"),
    )
    for response, status, code in cases:
        assert response.status_code == status
        assert response.headers["content-type"] == "application/json"
        assert_error_body(response.json())
        assert response.json()["code"] == code
    assert "GET" in client.delete("/api/health").headers["allow"]


def test_validation_failures_list_field_errors_without_the_raw_payload(client: TestClient) -> None:
    response = client.post("/api/integrations/clients/token", json={"client_secret": "secret-token"})

    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"detail", "code"}
    assert body["code"] == "validation_error"
    errors = body["detail"]
    assert errors and all(set(entry) == {"type", "loc", "msg"} for entry in errors)
    assert {entry["type"] for entry in errors} == {"missing"}
    assert "secret-token" not in response.text


def test_failures_never_carry_a_stack_trace_or_a_secret(client: TestClient) -> None:
    responses = (
        client.get("/api/does-not-exist"),
        client.get("/api/today"),
        client.get("/api/metrics", headers={"X-Metrics-Token": "secret-token"}),
        client.post("/api/integrations/clients/token", json={"client_secret": "secret-token"}),
    )
    for response in responses:
        assert "secret-token" not in response.text
        for marker in TRACE_MARKERS:
            assert marker not in response.text


@pytest.fixture
def broken_db() -> Generator[None]:
    def failing() -> Generator[None]:
        raise RuntimeError("secret-token postgresql://user:password@db/daynest")
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = failing
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.usefixtures("broken_db")
def test_an_unhandled_exception_answers_500_without_leaking_its_cause() -> None:
    payload = {"grant_type": "client_credentials", "client_id": "x", "client_secret": "secret-token"}
    unhandled = TestClient(app, raise_server_exceptions=False, base_url="http://localhost")
    response = unhandled.post("/api/integrations/clients/token", json=payload)

    assert response.status_code == 500
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"detail": "Internal server error", "code": "internal_error"}
    assert response.headers["x-request-id"]
    for secret in ("secret-token", "password", "postgresql"):
        assert secret not in response.text
    for marker in TRACE_MARKERS:
        assert marker not in response.text


@pytest.mark.anyio
async def test_the_unhandled_error_log_names_the_route_template_not_the_raw_path(
    caplog: pytest.LogCaptureFixture,
) -> None:
    # A path can carry a credential (the calendar feed token), so the log must never contain it.
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/calendar/feed/secret-feed-token.ics",
        "headers": [],
        "route": SimpleNamespace(path="/calendar/feed/{token}.ics"),
    }
    with caplog.at_level(logging.ERROR, logger="app.core.errors"):
        response = await handle_unhandled_exception(Request(scope), RuntimeError("boom"))

    assert response.status_code == 500
    message = next(r.getMessage() for r in caplog.records if r.name == "app.core.errors")
    assert "/calendar/feed/{token}.ics" in message
    assert "secret-feed-token" not in message
