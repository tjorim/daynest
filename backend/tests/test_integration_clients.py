import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.integration_auth import hash_integration_key
from app.core.config import settings
from app.main import app
from app.models.integration_client import IntegrationClient
from app.models.user import User


def _auth_as(user: User) -> None:
    async def _dep() -> User:
        return user

    app.dependency_overrides[get_current_user] = _dep


def _clear_auth() -> None:
    app.dependency_overrides.pop(get_current_user, None)


def _create_user(db_session: Session, email: str) -> User:
    user = User(email=email, full_name="Test User", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_client(db_session: Session, user_id: int, *, name: str = "Test") -> IntegrationClient:
    ic = IntegrationClient(
        user_id=user_id,
        name=name,
        key_hash=hash_integration_key(f"daynest_testkey_{user_id}_{name}"),
        rate_limit_per_minute=60,
    )
    db_session.add(ic)
    db_session.commit()
    db_session.refresh(ic)
    return ic


@pytest.fixture(autouse=True)
def _teardown_auth():
    yield
    _clear_auth()


class TestListIntegrationClients:
    def test_returns_own_clients(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "list@example.com")
        _create_client(db_session, user.id, name="Client A")
        _create_client(db_session, user.id, name="Client B")
        _auth_as(user)

        response = client.get("/api/integrations/clients")

        assert response.status_code == 200
        names = [c["name"] for c in response.json()]
        assert names == ["Client A", "Client B"]

    def test_does_not_return_other_users_clients(self, client: TestClient, db_session: Session) -> None:
        owner = _create_user(db_session, "owner@example.com")
        other = _create_user(db_session, "other@example.com")
        _create_client(db_session, other.id, name="Other's Client")
        _auth_as(owner)

        response = client.get("/api/integrations/clients")

        assert response.status_code == 200
        assert response.json() == []


class TestCreateIntegrationClient:
    def test_creates_and_returns_oauth_bundle(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "create@example.com")
        _auth_as(user)

        response = client.post(
            "/api/integrations/clients",
            json={"name": "New Client", "rate_limit_per_minute": 120},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "New Client"
        assert body["api_key"].startswith("daynest_")
        assert body["client_id"]
        assert body["client_secret"] == body["api_key"]
        assert body["token_url"].endswith("/api/integrations/clients/token")

    def test_api_key_is_hashed_in_db(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "hash@example.com")
        _auth_as(user)

        response = client.post(
            "/api/integrations/clients",
            json={"name": "Hashed", "rate_limit_per_minute": 60},
        )

        raw_key = response.json()["api_key"]
        db_client = db_session.query(IntegrationClient).filter_by(user_id=user.id).first()
        assert db_client is not None
        assert db_client.key_hash != raw_key
        assert db_client.key_hash == hash_integration_key(raw_key)


class TestRotateIntegrationClient:
    def test_rotate_returns_new_api_key(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "rotate@example.com")
        ic = _create_client(db_session, user.id, name="Rotatable")
        original_hash = ic.key_hash
        _auth_as(user)

        response = client.post(f"/api/integrations/clients/{ic.id}/rotate")

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == ic.id
        assert body["api_key"].startswith("daynest_")
        assert body["client_id"] == str(ic.id)
        assert body["client_secret"] == body["api_key"]
        assert body["token_url"].endswith("/api/integrations/clients/token")

        db_session.refresh(ic)
        assert ic.key_hash != original_hash
        assert ic.key_hash == hash_integration_key(body["api_key"])

    def test_rotate_other_users_client_returns_404(self, client: TestClient, db_session: Session) -> None:
        owner = _create_user(db_session, "rotateowner@example.com")
        attacker = _create_user(db_session, "rotateattacker@example.com")
        ic = _create_client(db_session, owner.id)
        _auth_as(attacker)

        response = client.post(f"/api/integrations/clients/{ic.id}/rotate")

        assert response.status_code == 404

    def test_rotate_nonexistent_client_returns_404(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "rotate404@example.com")
        _auth_as(user)

        response = client.post("/api/integrations/clients/99999/rotate")

        assert response.status_code == 404


class TestRevokeIntegrationClient:
    def test_revoke_deletes_client(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "revoke@example.com")
        ic = _create_client(db_session, user.id, name="To Delete")
        _auth_as(user)

        response = client.delete(f"/api/integrations/clients/{ic.id}")

        assert response.status_code == 204
        assert db_session.get(IntegrationClient, ic.id) is None

    def test_revoke_other_users_client_returns_404(self, client: TestClient, db_session: Session) -> None:
        owner = _create_user(db_session, "revokeowner@example.com")
        attacker = _create_user(db_session, "revokeattacker@example.com")
        ic = _create_client(db_session, owner.id)
        _auth_as(attacker)

        response = client.delete(f"/api/integrations/clients/{ic.id}")

        assert response.status_code == 404
        assert db_session.get(IntegrationClient, ic.id) is not None

    def test_revoke_nonexistent_client_returns_404(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "revoke404@example.com")
        _auth_as(user)

        response = client.delete("/api/integrations/clients/99999")

        assert response.status_code == 404


class TestExchangeIntegrationClientToken:
    def test_returns_bearer_token_for_valid_client_credentials(
        self,
        client: TestClient,
        db_session: Session,
    ) -> None:
        user = _create_user(db_session, "oauth@example.com")
        _auth_as(user)

        create_response = client.post(
            "/api/integrations/clients",
            json={"name": "OAuth Client", "rate_limit_per_minute": 120},
        )
        assert create_response.status_code == 200
        created = create_response.json()

        token_response = client.post(
            "/api/integrations/clients/token",
            data={
                "grant_type": "client_credentials",
                "client_id": created["client_id"],
                "client_secret": created["client_secret"],
            },
        )

        assert token_response.status_code == 200
        body = token_response.json()
        assert body["token_type"] == "Bearer"
        assert body["expires_in"] == 300
        # access_token must be a short-lived JWT, not the long-lived client_secret
        assert body["access_token"] != created["client_secret"]
        claims = jwt.decode(
            body["access_token"],
            settings.resolved_integration_key_hash_secret,
            algorithms=["HS256"],
            issuer="daynest-integration",
            options={"require": ["exp", "iss", "sub"]},
        )
        assert claims["sub"] == created["client_id"]

    def test_rejects_invalid_client_secret(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "oauth-invalid@example.com")
        _auth_as(user)
        created = client.post(
            "/api/integrations/clients",
            json={"name": "OAuth Client", "rate_limit_per_minute": 120},
        ).json()

        token_response = client.post(
            "/api/integrations/clients/token",
            data={
                "grant_type": "client_credentials",
                "client_id": created["client_id"],
                "client_secret": "not-the-right-secret",
            },
        )

        assert token_response.status_code == 401

    def test_rejects_mismatched_client_id(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "oauth-mismatch@example.com")
        _auth_as(user)
        created = client.post(
            "/api/integrations/clients",
            json={"name": "OAuth Client", "rate_limit_per_minute": 120},
        ).json()

        token_response = client.post(
            "/api/integrations/clients/token",
            data={
                "grant_type": "client_credentials",
                "client_id": "wrong-client-id",
                "client_secret": created["client_secret"],
            },
        )

        assert token_response.status_code == 401

    def test_rejects_unsupported_grant_type(self, client: TestClient, db_session: Session) -> None:
        user = _create_user(db_session, "oauth-grant@example.com")
        _auth_as(user)
        created = client.post(
            "/api/integrations/clients",
            json={"name": "OAuth Client", "rate_limit_per_minute": 120},
        ).json()

        token_response = client.post(
            "/api/integrations/clients/token",
            data={
                "grant_type": "authorization_code",
                "client_id": created["client_id"],
                "client_secret": created["client_secret"],
            },
        )

        assert token_response.status_code == 400
