"""Every JSON route declares a response model, so the OpenAPI document (and anything generated from it) names the
fields it answers with. Files and streams are not JSON documents and have no model."""

from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User
from app.routers.dependencies.auth import get_current_user
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


def _response_schemas(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """The component schemas a response can contain, directly or through another schema."""
    schemas = document["components"]["schemas"]
    found: dict[str, dict[str, Any]] = {}

    def visit(node: object) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key == "$ref":
                    name = value.rsplit("/", 1)[-1]
                    if name not in found:
                        found[name] = schemas[name]
                        visit(schemas[name])
                else:
                    visit(value)
        elif isinstance(node, list):
            for item in node:
                visit(item)

    for operations in document["paths"].values():
        for operation in operations.values():
            visit(operation["responses"])
    return found


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


# Explicit omissions, including framework-owned validation error schemas.
OPTIONAL_ON_THE_WIRE = {
    "HAEntityAttributes.unit_of_measurement": "Only count sensors send a unit; ratio/next-medication omit it.",
    "HTTPValidationError.detail": "FastAPI owns this optional error-envelope declaration.",
    "ValidationError.input": "FastAPI/Pydantic may omit rejected input in errors.",
    "ValidationError.ctx": "Only validators with additional context emit ctx.",
}


def optional_response_properties(document: dict[str, Any]) -> set[str]:
    """Inspect inline objects, arrays, unions and every reachable reference, including errors."""
    optional: set[str] = set()

    def visit(node: object, path: str) -> None:
        if isinstance(node, dict):
            for field in node.get("properties", {}):
                if field not in node.get("required", []):
                    optional.add(f"{path}.{field}")
            for key, value in node.items():
                if key != "$ref":
                    visit(value, f"{path}.{key}")
        elif isinstance(node, list):
            for index, item in enumerate(node):
                visit(item, f"{path}[{index}]")

    for name, schema in _response_schemas(document).items():
        visit(schema, name)
    for path, operations in document["paths"].items():
        for method, operation in operations.items():
            visit(operation["responses"], f"{method.upper()} {path}")
    return optional


def assert_optional_response_properties(document: dict[str, Any], exceptions: dict[str, str]) -> None:
    optional = optional_response_properties(document)
    assert all(reason.strip() for reason in exceptions.values()), "Every exception needs a reason"
    assert optional == set(exceptions), (
        f"Undocumented optional fields: {optional - exceptions.keys()}; "
        f"stale exceptions: {exceptions.keys() - optional}"
    )


def test_all_optional_response_properties_are_documented() -> None:
    assert_optional_response_properties(app.openapi(), OPTIONAL_ON_THE_WIRE)


def test_optional_check_catches_nested_fields_without_defaults_and_stale_exceptions() -> None:
    import pytest

    document = {
        "paths": {
            "/probe": {
                "get": {
                    "responses": {
                        "200": {"content": {"application/json": {"schema": {"$ref": "#/components/schemas/Probe"}}}}
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "Probe": {
                    "properties": {
                        "nested": {
                            "type": "array",
                            "items": {"anyOf": [{"type": "object", "properties": {"missing": {"type": "string"}}}]},
                        }
                    },
                    "required": ["nested"],
                }
            }
        },
    }
    field = "Probe.properties.nested.items.anyOf[0].missing"
    assert optional_response_properties(document) == {field}
    with pytest.raises(AssertionError, match="Undocumented"):
        assert_optional_response_properties(document, {})
    assert_optional_response_properties(document, {field: "Deliberately omitted probe field"})
    with pytest.raises(AssertionError, match="stale"):
        assert_optional_response_properties(document, {field: "Probe", "Probe.removed": "Old field"})


def test_schema_names_are_unique() -> None:
    """Two classes with one name make FastAPI qualify both (`app__schemas__x__Name`), and so any generated type."""
    qualified = [name for name in app.openapi()["components"]["schemas"] if "__" in name]
    assert qualified == []


# Open values with no fixed record shape; every other nested response object is modeled.
LOOSE_ON_THE_WIRE = {
    "JsonValue": "Exported legacy tags are JSON arrays, not constrained to strings by the DB/importer.",
    "ValidationError.properties.input": "Framework-owned rejected input can be any JSON value.",
    "ValidationError.properties.ctx": "Framework validators attach heterogeneous diagnostic context.",
}


def loose_response_properties(document: dict[str, Any]) -> set[str]:
    loose: set[str] = set()

    def visit(schema: dict[str, Any], path: str) -> None:
        if not (set(schema) - {"title", "description"}):
            loose.add(path)
        if schema.get("type") == "object" and not schema.get("properties"):
            extra = schema.get("additionalProperties", True)
            if extra is True or extra == {}:
                loose.add(path)
        for field, child in schema.get("properties", {}).items():
            visit(child, f"{path}.properties.{field}")
        for key in ("items", "additionalProperties"):
            if isinstance(schema.get(key), dict):
                visit(schema[key], f"{path}.{key}")
        for key in ("anyOf", "allOf", "oneOf"):
            for index, child in enumerate(schema.get(key, [])):
                visit(child, f"{path}.{key}[{index}]")

    for name, schema in _response_schemas(document).items():
        visit(schema, name)
    return loose


def test_nested_response_objects_are_modeled_or_justified() -> None:
    assert all(LOOSE_ON_THE_WIRE.values())
    assert loose_response_properties(app.openapi()) == set(LOOSE_ON_THE_WIRE)


def test_loose_check_rejects_nested_anonymous_objects() -> None:
    document = {
        "paths": {
            "/probe": {
                "get": {
                    "responses": {
                        "200": {"content": {"application/json": {"schema": {"$ref": "#/components/schemas/Probe"}}}}
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "Probe": {"type": "object", "properties": {"rows": {"type": "array", "items": {"type": "object"}}}}
            }
        },
    }
    assert loose_response_properties(document) == {"Probe.properties.rows.items"}
