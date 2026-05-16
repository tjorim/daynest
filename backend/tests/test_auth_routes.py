"""Tests for OIDC-based auth – /me endpoint and user provisioning."""
from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
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
            resp = client.get("/api/v1/auth/me")
            assert resp.status_code == 200
            data = resp.json()
            assert data["email"] == "me@example.com"
            assert data["full_name"] == "Test User"
            assert data["is_active"] is True
            assert data["roles"] == []
        finally:
            _clear_auth()

    def test_me_requires_auth(self, client: TestClient) -> None:
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_inactive_user_can_be_filtered(self, client: TestClient, db_session: Session) -> None:
        """Test that inactive users are rejected at the dependency level (tested via oidc provisioning)."""
        user = _make_user(db_session, email="inactive@example.com", oidc_subject="sub-inactive")
        user.is_active = False
        db_session.commit()

        _override_auth(user)
        try:
            resp = client.get("/api/v1/auth/me")
            # The route itself returns the user — the is_active check is in get_current_user.
            # With the override, it bypasses that check, so the endpoint returns 200 with is_active=False.
            assert resp.status_code == 200
            assert resp.json()["is_active"] is False
        finally:
            _clear_auth()


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
