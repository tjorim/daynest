"""Tests for auth endpoints – refresh token rotation and revocation."""
from __future__ import annotations

from datetime import timedelta, timezone
from datetime import datetime as dt

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.password import hash_password
from app.core.tokens import decode_token
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.repositories.refresh_token_repository import RefreshTokenRepository


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_user(db: Session, *, email: str = "test@example.com", password: str = "Secret123!", is_active: bool = True) -> User:
    user = User(
        email=email,
        full_name="Test User",
        password_hash=hash_password(password),
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _register(client: TestClient) -> dict:
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "reg@example.com", "password": "Secret123!", "full_name": "Reg User"},
    )
    assert resp.status_code == 201
    return resp.json()


def _login(client: TestClient, *, email: str = "log@example.com", password: str = "Secret123!") -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class TestRegister:
    def test_register_returns_token_pair(self, client: TestClient) -> None:
        tokens = _register(client)
        assert "access_token" in tokens
        assert "refresh_token" in tokens

    def test_register_stores_jti_in_db(self, client: TestClient, db_session: Session) -> None:
        tokens = _register(client)
        claims = decode_token(tokens["refresh_token"])
        jti = claims["jti"]
        stored = db_session.scalar(
            select(RefreshToken).where(RefreshToken.jti == jti)
        )
        assert stored is not None
        assert stored.revoked_at is None

    def test_duplicate_email_returns_409(self, client: TestClient) -> None:
        _register(client)
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": "reg@example.com", "password": "AnotherPass1!", "full_name": "Dup"},
        )
        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class TestLogin:
    def test_login_stores_jti_in_db(self, client: TestClient, db_session: Session) -> None:
        _create_user(db_session, email="log@example.com")
        tokens = _login(client)
        claims = decode_token(tokens["refresh_token"])
        stored = db_session.scalar(
            select(RefreshToken).where(RefreshToken.jti == claims["jti"])
        )
        assert stored is not None

    def test_login_inactive_user_returns_401(self, client: TestClient, db_session: Session) -> None:
        _create_user(db_session, email="inactive@example.com", is_active=False)
        resp = client.post("/api/v1/auth/login", json={"email": "inactive@example.com", "password": "Secret123!"})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Refresh – happy path
# ---------------------------------------------------------------------------

class TestRefreshRotation:
    def test_refresh_returns_new_token_pair(self, client: TestClient) -> None:
        first = _register(client)
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert resp.status_code == 200
        second = resp.json()
        assert "access_token" in second
        assert "refresh_token" in second
        # Tokens must differ
        assert second["refresh_token"] != first["refresh_token"]

    def test_refresh_old_token_is_revoked(self, client: TestClient, db_session: Session) -> None:
        first = _register(client)
        old_jti = decode_token(first["refresh_token"])["jti"]

        client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})

        stored = db_session.scalar(
            select(RefreshToken).where(RefreshToken.jti == old_jti)
        )
        assert stored is not None
        assert stored.revoked_at is not None

    def test_refresh_new_jti_stored(self, client: TestClient, db_session: Session) -> None:
        first = _register(client)
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        new_jti = decode_token(resp.json()["refresh_token"])["jti"]
        stored = db_session.scalar(
            select(RefreshToken).where(RefreshToken.jti == new_jti)
        )
        assert stored is not None
        assert stored.revoked_at is None

    def test_chained_refresh_works(self, client: TestClient) -> None:
        tokens = _register(client)
        for _ in range(3):
            resp = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
            assert resp.status_code == 200
            tokens = resp.json()


# ---------------------------------------------------------------------------
# Refresh – reuse detection
# ---------------------------------------------------------------------------

class TestRefreshReuseDetection:
    def test_reused_token_returns_401(self, client: TestClient) -> None:
        first = _register(client)
        # First use: valid rotation
        client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        # Second use of the same (now revoked) token: reuse!
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert resp.status_code == 401
        assert "reuse" in resp.json()["detail"].lower()

    def test_reuse_revokes_entire_family(self, client: TestClient, db_session: Session) -> None:
        first = _register(client)
        old_jti = decode_token(first["refresh_token"])["jti"]

        rotate_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert rotate_resp.status_code == 200
        new_jti = decode_token(rotate_resp.json()["refresh_token"])["jti"]

        # Trigger reuse with the old token
        client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})

        # Both JTIs from this test must be revoked
        revoked_count = db_session.scalar(
            select(func.count())
            .select_from(RefreshToken)
            .where(RefreshToken.jti.in_([old_jti, new_jti]))
            .where(RefreshToken.revoked_at.is_not(None))
        )
        assert revoked_count == 2


# ---------------------------------------------------------------------------
# Refresh – edge cases
# ---------------------------------------------------------------------------

class TestRefreshEdgeCases:
    def test_invalid_token_returns_401(self, client: TestClient) -> None:
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "not.a.valid.token"})
        assert resp.status_code == 401

    def test_access_token_as_refresh_returns_401(self, client: TestClient) -> None:
        tokens = _register(client)
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["access_token"]})
        assert resp.status_code == 401

    def test_refresh_with_inactive_user_returns_401(self, client: TestClient, db_session: Session) -> None:
        # Register (user is active at this point) and capture token
        tokens = _register(client)
        # Deactivate the user directly in the DB
        user = db_session.scalar(select(User).where(User.email == "reg@example.com"))
        assert user is not None
        user.is_active = False
        db_session.commit()

        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert resp.status_code == 401

    def test_refresh_token_missing_jti_returns_401(self, client: TestClient, db_session: Session) -> None:
        """A token crafted without a jti claim must be rejected."""
        user = _create_user(db_session, email="nojti@example.com")
        # Craft a token without jti
        token = jwt.encode(
            {
                "sub": str(user.id),
                "email": user.email,
                "type": "refresh",
                "iat": dt.now(timezone.utc),
                "exp": dt.now(timezone.utc) + timedelta(days=7),
            },
            settings.resolved_jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": token})
        assert resp.status_code == 401

    def test_refresh_token_unknown_jti_returns_401(self, client: TestClient, db_session: Session) -> None:
        """A token whose jti was never stored in the DB must be rejected."""
        user = _create_user(db_session, email="unknownjti@example.com")
        token = jwt.encode(
            {
                "sub": str(user.id),
                "email": user.email,
                "type": "refresh",
                "jti": "00000000-0000-0000-0000-000000000000",
                "iat": dt.now(timezone.utc),
                "exp": dt.now(timezone.utc) + timedelta(days=7),
            },
            settings.resolved_jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": token})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# RefreshTokenRepository unit tests
# ---------------------------------------------------------------------------

class TestRefreshTokenRepository:
    def test_create_and_get_by_jti(self, db_session: Session) -> None:
        user = _create_user(db_session, email="repo@example.com")
        repo = RefreshTokenRepository(db_session)
        expires = dt.now(timezone.utc) + timedelta(days=7)
        record = repo.create(user_id=user.id, jti="abc-123", expires_at=expires)
        assert record.id is not None
        assert record.revoked_at is None

        fetched = repo.get_by_jti("abc-123")
        assert fetched is not None
        assert fetched.id == record.id

    def test_revoke_sets_revoked_at(self, db_session: Session) -> None:
        user = _create_user(db_session, email="revoke@example.com")
        repo = RefreshTokenRepository(db_session)
        record = repo.create(user_id=user.id, jti="xyz-999", expires_at=dt.now(timezone.utc) + timedelta(days=7))
        repo.revoke(record)
        assert record.revoked_at is not None

    def test_revoke_all_for_user(self, db_session: Session) -> None:
        user = _create_user(db_session, email="all@example.com")
        repo = RefreshTokenRepository(db_session)
        expires = dt.now(timezone.utc) + timedelta(days=7)
        repo.create(user_id=user.id, jti="j1", expires_at=expires)
        repo.create(user_id=user.id, jti="j2", expires_at=expires)
        repo.revoke_all_for_user(user.id)

        tokens = list(db_session.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id)).all())
        assert all(t.revoked_at is not None for t in tokens)
