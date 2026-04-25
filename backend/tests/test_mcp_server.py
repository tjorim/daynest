import asyncio
from datetime import date, time

from sqlalchemy.orm import Session, sessionmaker

from app.api.dependencies.integration_auth import hash_integration_key
from app.mcp_server import DaynestMcpBackend, IntegrationKeyTokenVerifier
from app.models.chore_template import ChoreTemplate
from app.models.integration_client import IntegrationClient
from app.models.medication_plan import MedicationPlan
from app.models.routine_template import RoutineTemplate
from app.models.user import User


def _session_factory(db_session: Session) -> sessionmaker[Session]:
    return sessionmaker(bind=db_session.bind, autoflush=False, autocommit=False, expire_on_commit=False)


def _create_user(db_session: Session, email: str) -> User:
    user = User(email=email, full_name="Test User", password_hash="hashed-password", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_integration_client(
    db_session: Session,
    user: User,
    *,
    raw_key: str,
    scopes: str = "mcp:read",
    rate_limit_per_minute: int = 50,
) -> IntegrationClient:
    client = IntegrationClient(
        user_id=user.id,
        name="MCP Client",
        key_hash=hash_integration_key(raw_key),
        scopes_csv=scopes,
        rate_limit_per_minute=rate_limit_per_minute,
        is_active=True,
    )
    db_session.add(client)
    db_session.commit()
    db_session.refresh(client)
    return client


def test_mcp_backend_resolves_single_active_user_and_returns_today(db_session: Session) -> None:
    user = _create_user(db_session, "mcp@example.com")
    db_session.add(
        RoutineTemplate(
            user_id=user.id,
            name="Morning reset",
            description="Kitchen and windows",
            start_date=date.today(),
            every_n_days=1,
            due_time=time(8, 0),
            is_active=True,
        )
    )
    db_session.add(
        ChoreTemplate(
            user_id=user.id,
            name="Take out trash",
            description=None,
            start_date=date.today(),
            every_n_days=1,
            is_active=True,
        )
    )
    db_session.add(
        MedicationPlan(
            user_id=user.id,
            name="Vitamin D",
            instructions="Take with breakfast",
            start_date=date.today(),
            schedule_time=time(9, 0),
            every_n_days=1,
            is_active=True,
        )
    )
    db_session.commit()

    backend = DaynestMcpBackend(_session_factory(db_session))

    whoami = backend.whoami()
    payload = backend.get_today()

    assert whoami["email"] == "mcp@example.com"
    assert payload["routines"][0]["title"] == "Morning reset"
    assert payload["due_today"][0]["title"] == "Take out trash"
    assert payload["medication"][0]["name"] == "Vitamin D"


def test_mcp_backend_requires_explicit_user_when_multiple_accounts_exist(db_session: Session) -> None:
    _create_user(db_session, "one@example.com")
    _create_user(db_session, "two@example.com")

    backend = DaynestMcpBackend(_session_factory(db_session))

    try:
        backend.whoami()
    except ValueError as exc:
        assert "DAYNEST_USER_EMAIL" in str(exc)
        assert "one@example.com" in str(exc)
        assert "two@example.com" in str(exc)
    else:
        raise AssertionError("Expected multiple-user resolution to require DAYNEST_USER_EMAIL")


def test_mcp_backend_can_create_and_update_planned_items(db_session: Session) -> None:
    user = _create_user(db_session, "planned@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_planned_item(
        title="Pick up groceries",
        planned_for="2026-04-25",
        notes="Milk and eggs",
        module_key="shopping_list",
    )
    updated = backend.update_planned_item(
        planned_item_id=created["id"],
        title="Pick up groceries",
        planned_for="2026-04-25",
        is_done=True,
        notes="Milk and eggs",
        module_key="shopping_list",
    )

    assert created["title"] == "Pick up groceries"
    assert updated["is_done"] is True


def test_integration_key_token_verifier_accepts_mcp_scoped_key(db_session: Session) -> None:
    user = _create_user(db_session, "token@example.com")
    client = _create_integration_client(db_session, user, raw_key="daynest_valid_key")
    verifier = IntegrationKeyTokenVerifier(_session_factory(db_session), resource_server_url="https://daynest.example.com/mcp")

    token = asyncio.run(verifier.verify_token("daynest_valid_key"))

    assert token is not None
    assert token.client_id == str(client.id)
    assert "mcp:read" in token.scopes
    assert token.resource == "https://daynest.example.com/mcp"


def test_integration_key_token_verifier_rejects_wrong_scope(db_session: Session) -> None:
    user = _create_user(db_session, "wrong-scope@example.com")
    _create_integration_client(db_session, user, raw_key="daynest_wrong_scope", scopes="ha:read")
    verifier = IntegrationKeyTokenVerifier(_session_factory(db_session))

    token = asyncio.run(verifier.verify_token("daynest_wrong_scope"))

    assert token is None


def test_mcp_backend_uses_authenticated_integration_owner(db_session: Session, monkeypatch) -> None:
    user = _create_user(db_session, "auth-owner@example.com")
    client = _create_integration_client(db_session, user, raw_key="daynest_auth_owner")
    backend = DaynestMcpBackend(_session_factory(db_session))

    class AccessTokenStub:
        client_id = str(client.id)

    monkeypatch.setattr("app.mcp_server.get_access_token", lambda: AccessTokenStub())

    whoami = backend.whoami()

    assert whoami["email"] == "auth-owner@example.com"
