"""Every JSON route declares a response model, so the OpenAPI document (and anything generated from it) names the
fields it answers with. Files and streams are not JSON documents and have no model."""

from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.main import app
from app.models.user import User
from app.services.export_import_service import build_user_export


def untyped_json_responses(document: dict[str, Any]) -> list[str]:
    """Operations whose successful JSON response is not a named model (or a list of them)."""
    untyped = []
    for path, operations in document["paths"].items():
        for method, operation in operations.items():
            for status, response in operation["responses"].items():
                schema = response.get("content", {}).get("application/json", {}).get("schema")
                if not status.startswith("2") or schema is None:
                    continue
                described = schema.get("items", schema)
                if "$ref" not in described:
                    untyped.append(f"{method.upper()} {path} -> {status}")
    return untyped


def test_every_json_route_declares_a_response_model() -> None:
    assert untyped_json_responses(app.openapi()) == []


def test_the_check_catches_routes_without_a_model() -> None:
    probe = FastAPI()

    @probe.get("/bare-dict")
    def bare_dict() -> dict[str, str]:
        return {}

    @probe.get("/no-annotation")
    def no_annotation():
        return {}

    @probe.get("/open-object", response_model=dict[str, Any])
    def open_object() -> dict[str, Any]:
        return {}

    assert untyped_json_responses(probe.openapi()) == [
        "GET /bare-dict -> 200",
        "GET /no-annotation -> 200",
        "GET /open-object -> 200",
    ]


def test_files_and_streams_are_not_declared_as_json() -> None:
    paths = app.openapi()["paths"]
    for path in ("/api/calendar/export.ics", "/api/calendar/feed/{token}.ics"):
        assert list(paths[path]["get"]["responses"]["200"]["content"]) == ["text/calendar"]
    assert list(paths["/api/today/stream"]["get"]["responses"]["200"]["content"]) == ["text/event-stream"]
    assert set(paths["/api/users/me/export"]["get"]["responses"]["200"]["content"]) == {
        "application/json",
        "text/csv",
    }


def test_the_user_export_keeps_its_wire_shape(client: TestClient, db_session: Session) -> None:
    user = User(email="export-shape@example.com", full_name="Export Shape", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    async def _current_user() -> User:
        return user

    app.dependency_overrides[get_current_user] = _current_user
    try:
        body = client.get("/api/users/me/export").json()
        expected = build_user_export(db_session, user)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert body.keys() == expected.keys()
    assert {key: value for key, value in body.items() if key != "exported_at"} == {
        key: value for key, value in expected.items() if key != "exported_at"
    }


def test_system_endpoints_keep_their_wire_shape(client: TestClient) -> None:
    assert client.get("/api/health/liveness").json() == {"status": "alive"}
    assert client.get("/api/meta").json().keys() == {"name", "version"}
    assert client.get("/api/health").json().keys() == {
        "status",
        "version",
        "commit",
        "liveness",
        "readiness_endpoint",
    }
    assert client.get("/").json().keys() == {
        "name",
        "message",
        "liveness",
        "readiness",
        "metrics",
        "ha_summary",
        "mcp",
        "mcp_capabilities",
    }
