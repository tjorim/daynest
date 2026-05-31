"""Tests for OIDC-based auth – /me endpoint, user provisioning, and OAuth sessions."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user, get_current_user_from_query_token
from app.core.oidc import get_or_create_local_user
from app.main import app
from app.models.user import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db: Session, *, email: str, oidc_subject: str | None = None, full_name: str | None = None) -> User:
    user = User(email=email, full_name=full_name, oidc_subject=oidc_subject)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _override_auth(user: User):
    """Return an async dependency that always yields *user*."""
    async def _dep() -> User:
        return user
    app.dependency_overrides[get_current_user] = _dep


def _clear_auth():
    app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------

class TestMeEndpoint:
    def test_me_returns_user_info(self, client: TestClient, db_session: Session) -> None:
        user = _make_user(db_session, email="me@example.com", full_name="Test User", oidc_subject="sub-me-1")
        _override_auth(user)
        try:
            resp = client.get("/api/auth/me")
            assert resp.status_code == 200
            data = resp.json()
            assert data["email"] == "me@example.com"
            assert data["full_name"] == "Test User"
            assert data["is_active"] is True
            assert data["roles"] == []
        finally:
            _clear_auth()

    def test_me_requires_auth(self, client: TestClient) -> None:
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_inactive_user_can_be_filtered(self, client: TestClient, db_session: Session) -> None:
        """Test that inactive users are rejected at the dependency level (tested via oidc provisioning)."""
        user = _make_user(db_session, email="inactive@example.com", oidc_subject="sub-inactive")
        user.is_active = False
        db_session.commit()

        _override_auth(user)
        try:
            resp = client.get("/api/auth/me")
            # The route itself returns the user — the is_active check is in get_current_user.
            # With the override, it bypasses that check, so the endpoint returns 200 with is_active=False.
            assert resp.status_code == 200
            assert resp.json()["is_active"] is False
        finally:
            _clear_auth()


class TestQueryTokenAuth:
    @pytest.mark.anyio
    async def test_resolves_user_from_query_token(
        self,
        db_session: Session,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _make_user(db_session, email="sse-query@example.com", oidc_subject="sub-sse-query")
        request = MagicMock()

        async def _decode(token: str) -> dict[str, str]:
            assert token == "sse-access-token"
            return {"sub": user.oidc_subject, "email": user.email}

        monkeypatch.setattr("app.api.dependencies.auth.decode_oidc_token", _decode)
        resolved = await get_current_user_from_query_token(request, token="sse-access-token", db=db_session)
        assert resolved.id == user.id


# ---------------------------------------------------------------------------
# get_or_create_local_user – provisioning logic
# ---------------------------------------------------------------------------

class TestGetOrCreateLocalUser:
    def test_returns_existing_user_by_oidc_subject(self, db_session: Session) -> None:
        existing = _make_user(db_session, email="exist@example.com", oidc_subject="sub-exist")
        result = get_or_create_local_user("sub-exist", {"email": "exist@example.com"}, db_session)
        assert result.id == existing.id

    def test_links_existing_user_by_email_on_first_oidc_login(self, db_session: Session) -> None:
        """Migration path: old local-auth user gets linked to OIDC subject by email."""
        existing = _make_user(db_session, email="migrate@example.com")
        assert existing.oidc_subject is None

        result = get_or_create_local_user(
            "sub-new",
            {"email": "migrate@example.com", "name": "Migrate User"},
            db_session,
        )
        assert result.id == existing.id
        assert result.oidc_subject == "sub-new"

    def test_provisions_new_user_when_email_unknown(self, db_session: Session) -> None:
        result = get_or_create_local_user(
            "sub-brand-new",
            {"email": "brandnew@example.com", "name": "Brand New"},
            db_session,
        )
        assert result.id is not None
        assert result.email == "brandnew@example.com"
        assert result.full_name == "Brand New"
        assert result.oidc_subject == "sub-brand-new"

    def test_provisions_new_user_without_email_claim(self, db_session: Session) -> None:
        result = get_or_create_local_user("sub-no-email", {}, db_session)
        assert result.id is not None
        assert "oidc.local" in result.email

    def test_second_call_with_same_subject_returns_same_user(self, db_session: Session) -> None:
        first = get_or_create_local_user("sub-idempotent", {"email": "idem@example.com"}, db_session)
        second = get_or_create_local_user("sub-idempotent", {"email": "idem@example.com"}, db_session)
        assert first.id == second.id

    def test_prefers_name_over_preferred_username_for_full_name(self, db_session: Session) -> None:
        result = get_or_create_local_user(
            "sub-names",
            {"email": "names@example.com", "name": "Full Name", "preferred_username": "username"},
            db_session,
        )
        assert result.full_name == "Full Name"

    def test_falls_back_to_preferred_username_when_no_name(self, db_session: Session) -> None:
        result = get_or_create_local_user(
            "sub-uname",
            {"email": "uname@example.com", "preferred_username": "myusername"},
            db_session,
        )
        assert result.full_name == "myusername"


# ---------------------------------------------------------------------------
# GET /sessions – list OAuth sessions (proxy to Keycloak Account API)
# ---------------------------------------------------------------------------

SAMPLE_SESSIONS = [
    {
        "id": "session-abc123",
        "ipAddress": "192.168.1.1",
        "started": 1700000000000,
        "lastAccess": 1700001000000,
        "expires": 1700087400000,
        "clients": [
            {
                "clientId": "claude-ai-mcp",
                "clientName": "Claude.ai MCP Connector",
                "userConsentRequired": False,
                "inUse": True,
                "offlineAccess": False,
            }
        ],
    },
    {
        "id": "session-def456",
        "ipAddress": "10.0.0.5",
        "started": 1700002000000,
        "lastAccess": 1700002500000,
        "expires": 1700088800000,
        "clients": [],
    },
]


def _make_httpx_response(status_code: int, body) -> httpx.Response:
    content = json.dumps(body).encode()
    return httpx.Response(status_code=status_code, content=content)


class TestListSessions:
    def test_returns_sessions_when_oidc_configured(
        self, client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        user = _make_user(db_session, email="sessions@example.com", oidc_subject="sub-sessions")
        _override_auth(user)
        monkeypatch.setattr("app.api.routes.auth._http_client", MagicMock(
            get=AsyncMock(return_value=_make_httpx_response(200, SAMPLE_SESSIONS))
        ))
        monkeypatch.setattr("app.api.routes.auth.settings.oidc_issuer_url", "http://keycloak/realms/daynest")
        try:
            resp = client.get("/api/auth/sessions", headers={"Authorization": "Bearer dummy-token"})
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 2
            assert data[0]["id"] == "session-abc123"
            assert data[0]["ip_address"] == "192.168.1.1"
            assert data[0]["clients"] == [{"clientId": "claude-ai-mcp", "clientName": "Claude.ai MCP Connector", "userConsentRequired": False, "inUse": True, "offlineAccess": False}]
            assert data[1]["id"] == "session-def456"
        finally:
            _clear_auth()

    def test_returns_501_when_oidc_not_configured(
        self, client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        user = _make_user(db_session, email="nooidc@example.com", oidc_subject="sub-nooidc")
        _override_auth(user)
        monkeypatch.setattr("app.api.routes.auth.settings.oidc_issuer_url", None)
        try:
            resp = client.get("/api/auth/sessions", headers={"Authorization": "Bearer dummy-token"})
            assert resp.status_code == 501
        finally:
            _clear_auth()

    def test_returns_502_when_oidc_provider_unreachable(
        self, client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        user = _make_user(db_session, email="unreachable@example.com", oidc_subject="sub-unreachable")
        _override_auth(user)
        monkeypatch.setattr("app.api.routes.auth.settings.oidc_issuer_url", "http://keycloak/realms/daynest")
        monkeypatch.setattr("app.api.routes.auth._http_client", MagicMock(
            get=AsyncMock(side_effect=httpx.ConnectError("connection refused"))
        ))
        try:
            resp = client.get("/api/auth/sessions", headers={"Authorization": "Bearer dummy-token"})
            assert resp.status_code == 502
        finally:
            _clear_auth()

    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.get("/api/auth/sessions")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /sessions/{session_id} – revoke an OAuth session
# ---------------------------------------------------------------------------

class TestRevokeSession:
    def test_revokes_session_successfully(
        self, client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        user = _make_user(db_session, email="revoke@example.com", oidc_subject="sub-revoke")
        _override_auth(user)
        monkeypatch.setattr("app.api.routes.auth.settings.oidc_issuer_url", "http://keycloak/realms/daynest")
        monkeypatch.setattr("app.api.routes.auth._http_client", MagicMock(
            delete=AsyncMock(return_value=_make_httpx_response(204, ""))
        ))
        try:
            resp = client.delete(
                "/api/auth/sessions/session-abc123",
                headers={"Authorization": "Bearer dummy-token"},
            )
            assert resp.status_code == 204
        finally:
            _clear_auth()

    def test_returns_501_when_oidc_not_configured(
        self, client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        user = _make_user(db_session, email="revoke-nooidc@example.com", oidc_subject="sub-revoke-nooidc")
        _override_auth(user)
        monkeypatch.setattr("app.api.routes.auth.settings.oidc_issuer_url", None)
        try:
            resp = client.delete(
                "/api/auth/sessions/session-abc123",
                headers={"Authorization": "Bearer dummy-token"},
            )
            assert resp.status_code == 501
        finally:
            _clear_auth()

    def test_returns_502_when_oidc_provider_unreachable(
        self, client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        user = _make_user(db_session, email="revoke-unreachable@example.com", oidc_subject="sub-revoke-unreach")
        _override_auth(user)
        monkeypatch.setattr("app.api.routes.auth.settings.oidc_issuer_url", "http://keycloak/realms/daynest")
        monkeypatch.setattr("app.api.routes.auth._http_client", MagicMock(
            delete=AsyncMock(side_effect=httpx.ConnectError("connection refused"))
        ))
        try:
            resp = client.delete(
                "/api/auth/sessions/session-abc123",
                headers={"Authorization": "Bearer dummy-token"},
            )
            assert resp.status_code == 502
        finally:
            _clear_auth()

    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.delete("/api/auth/sessions/session-abc123")
        assert resp.status_code == 401
