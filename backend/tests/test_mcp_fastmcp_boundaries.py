"""Application-level guards for FastMCP upgrades (tool-body errors, MultiAuth, stateless HTTP, discovery)."""

import logging
import time
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastmcp import Client
from fastmcp.exceptions import ToolError
from fastmcp.server.auth import JWTVerifier, MultiAuth, RemoteAuthProvider
from pydantic import AnyHttpUrl, BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker
from starlette.testclient import TestClient

from app.api.dependencies.integration_auth import hash_integration_key
from app.core.config import settings
from app.mcp_server import DaynestMcpBackend, create_mcp_server
from app.models.audit_entry import AuditEntry
from app.models.integration_client import IntegrationClient
from app.models.user import User

PRIVATE = "PRIVATE-NOTE-9f3a"
ISSUER = "https://auth.example/realms/daynest"
INTEGRATION_KEY = "daynest_fastmcp_boundary_key"
RPC_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def _session_factory(db_session: Session) -> sessionmaker[Session]:
    return sessionmaker(bind=db_session.bind, autoflush=False, autocommit=False, expire_on_commit=False)


def _user(db_session: Session, email: str = "owner@example.com") -> User:
    user = User(email=email, full_name="Owner", password_hash="hashed-password", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def local_server(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "oidc_issuer_url", None)
    _user(db_session)
    return create_mcp_server(DaynestMcpBackend(_session_factory(db_session), user_email="owner@example.com"))


def _audit_count(db_session: Session) -> int:
    return db_session.scalar(select(func.count()).select_from(AuditEntry)) or 0


async def _call(mcp, name: str, arguments: dict, *, through_proxy: bool) -> ToolError:
    async with Client(mcp) as client:
        with pytest.raises(ToolError) as excinfo:
            if through_proxy:
                await client.call_tool("call_tool", {"name": name, "arguments": arguments})
            else:
                await client.call_tool(name, arguments)
    return excinfo.value


TOOL_BODY_ARGUMENT_FAILURES = [
    ("set_meal_slot", {"meal_plan_id": 1, "slot_id": 1, "title": PRIVATE + "x" * 300}, "title"),
    ("update_shopping_list", {"shopping_list_id": 1, "name": ""}, "name"),
]


@pytest.mark.anyio
@pytest.mark.parametrize("through_proxy", [False, True], ids=["direct", "call_tool_proxy"])
@pytest.mark.parametrize(("tool", "arguments", "field"), TOOL_BODY_ARGUMENT_FAILURES)
async def test_tool_body_argument_failures_are_sanitised_and_not_audited(
    db_session: Session,
    local_server,
    caplog: pytest.LogCaptureFixture,
    tool: str,
    arguments: dict,
    field: str,
    through_proxy: bool,
) -> None:
    with caplog.at_level(logging.DEBUG):
        error = await _call(local_server, tool, arguments, through_proxy=through_proxy)

    assert "Invalid arguments" in str(error)
    assert field in str(error)
    assert "input_value" not in str(error)
    assert PRIVATE not in str(error)
    assert PRIVATE not in caplog.text
    assert "input_value" not in caplog.text
    assert _audit_count(db_session) == 0


class _StoredRecord(BaseModel):
    title: str = Field(max_length=10)


@pytest.mark.anyio
@pytest.mark.parametrize("through_proxy", [False, True], ids=["direct", "call_tool_proxy"])
async def test_invalid_stored_result_is_correlated_and_distinct_from_argument_failures(
    db_session: Session,
    local_server,
    caplog: pytest.LogCaptureFixture,
    through_proxy: bool,
) -> None:
    def invalid_stored_row(*_args, **_kwargs):
        return _StoredRecord.model_validate({"title": PRIVATE + "x" * 50})

    with (
        patch.object(DaynestMcpBackend, "list_meal_plans", invalid_stored_row),
        caplog.at_level(logging.DEBUG),
    ):
        error = await _call(local_server, "list_meal_plans", {}, through_proxy=through_proxy)

    message = str(error)
    assert "could not return a valid result" in message
    assert "reference " in message
    assert "Invalid arguments" not in message
    assert PRIVATE not in message
    assert PRIVATE not in caplog.text
    reference = message.rsplit("reference ", 1)[1].rstrip(").")
    assert any(reference in record.getMessage() for record in caplog.records)
    assert _audit_count(db_session) == 0


@pytest.mark.anyio
@pytest.mark.parametrize("through_proxy", [False, True], ids=["direct", "call_tool_proxy"])
async def test_wrong_argument_types_and_unknown_tools_are_rejected(
    db_session: Session, local_server, through_proxy: bool
) -> None:
    wrong_type = await _call(local_server, "get_calendar_month", {"year": "x", "month": 1}, through_proxy=through_proxy)
    unknown = await _call(local_server, "no_such_tool", {}, through_proxy=through_proxy)

    assert "year" in str(wrong_type)
    assert "no_such_tool" in str(unknown)
    assert _audit_count(db_session) == 0


@pytest.mark.anyio
async def test_repeated_discovery_searches_stay_current(local_server) -> None:
    async with Client(local_server) as client:
        first = await client.call_tool("search_tools", {"query": "shopping list items"})
        second = await client.call_tool("search_tools", {"query": "shopping list items"})
        other = await client.call_tool("search_tools", {"query": "medication dose"})

    assert first.structured_content == second.structured_content
    assert first.structured_content is not None and other.structured_content is not None
    shopping = first.structured_content["result"]
    assert any(item["name"] == "add_shopping_item" for item in shopping)
    assert all("inputSchema" in item or "input_schema" in item for item in shopping)
    assert {item["name"] for item in other.structured_content["result"]} != {item["name"] for item in shopping}


@pytest.fixture()
def keycloak_keypair() -> tuple[bytes, bytes]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
    public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    return private, public


def _rpc(client: TestClient, token: str | None, name: str, arguments: dict | None = None):
    headers = dict(RPC_HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.post(
        "/mcp",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments or {}},
        },
    )


def test_multiauth_resolves_keycloak_and_integration_principals_over_stateless_http(
    db_session: Session, monkeypatch: pytest.MonkeyPatch, keycloak_keypair: tuple[bytes, bytes]
) -> None:
    """MultiAuth qualifies client IDs by source in FastMCP 4.1; principal resolution must not depend on that shape."""
    private_key, public_key = keycloak_keypair
    monkeypatch.setattr(settings, "oidc_issuer_url", ISSUER)
    monkeypatch.setattr(settings, "oidc_audience", "daynest")
    owner = _user(db_session)
    db_session.add(
        IntegrationClient(
            user_id=owner.id,
            name="Boundary client",
            key_hash=hash_integration_key(INTEGRATION_KEY),
            rate_limit_per_minute=50,
            is_active=True,
            scopes=["mcp:*"],
        )
    )
    db_session.commit()

    def stand_in_keycloak(*, realm_url: str, base_url: str, audience: str, required_scopes: list[str]):
        return RemoteAuthProvider(
            token_verifier=JWTVerifier(public_key=public_key.decode(), issuer=realm_url, audience=audience),
            authorization_servers=[AnyHttpUrl(realm_url)],
            base_url=base_url,
        )

    with patch("app.mcp_server.KeycloakAuthProvider", stand_in_keycloak):
        mcp = create_mcp_server(DaynestMcpBackend(_session_factory(db_session)))
    assert isinstance(mcp.auth, MultiAuth)

    oidc_token = jwt.encode(
        {
            "sub": "keycloak-subject-1",
            "iss": ISSUER,
            "aud": "daynest",
            "exp": int(time.time()) + 300,
            "preferred_username": "kc-user",
            "email": "kc-user@example.com",
        },
        private_key,
        algorithm="RS256",
    )

    # Stateless: every request is self-contained, with no initialize call and no session id.
    with TestClient(mcp.http_app(path="/mcp", stateless_http=True), base_url="https://api.example") as client:
        assert _rpc(client, None, "whoami").status_code == 401
        assert _rpc(client, "garbage", "whoami").status_code == 401

        oidc_response = _rpc(client, oidc_token, "whoami")
        assert oidc_response.status_code == 200
        assert "kc-user@example.com" in oidc_response.text
        assert "mcp-session-id" not in {name.lower() for name in oidc_response.headers}

        integration_response = _rpc(client, INTEGRATION_KEY, "whoami")
        assert integration_response.status_code == 200
        assert "owner@example.com" in integration_response.text
        assert '"isError":false' in integration_response.text.replace(" ", "")

        # Managed credentials stay barred from interactive-only tools.
        barred = _rpc(client, INTEGRATION_KEY, "call_tool", {"name": "list_users", "arguments": {}})
        assert barred.status_code == 200
        assert '"isError":true' in barred.text.replace(" ", "")
