import asyncio
from datetime import datetime, time, timezone

import pytest

from sqlalchemy.orm import Session, sessionmaker

from app.api.dependencies.integration_auth import hash_integration_key
from app.mcp_server import DaynestMcpAccessToken, DaynestMcpBackend, IntegrationKeyTokenVerifier, OIDCMcpTokenVerifier, create_mcp_server
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
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "mcp@example.com")
    db_session.add(
        RoutineTemplate(
            user_id=user.id,
            name="Morning reset",
            description="Kitchen and windows",
            start_date=utc_today,
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
            start_date=utc_today,
            every_n_days=1,
            is_active=True,
        )
    )
    db_session.add(
        MedicationPlan(
            user_id=user.id,
            name="Vitamin D",
            instructions="Take with breakfast",
            start_date=utc_today,
            schedule_time=time(9, 0),
            every_n_days=1,
            is_active=True,
        )
    )
    db_session.commit()

    backend = DaynestMcpBackend(_session_factory(db_session))

    whoami = backend.whoami()
    payload = backend.get_today(utc_today.isoformat())

    assert whoami["email"] == "mcp@example.com"
    assert payload["routines"][0]["title"] == "Morning reset"
    assert payload["due_today"][0]["title"] == "Take out trash"
    assert payload["medication"][0]["name"] == "Vitamin D"


def test_mcp_backend_requires_explicit_user_when_multiple_accounts_exist(db_session: Session) -> None:
    _create_user(db_session, "one@example.com")
    _create_user(db_session, "two@example.com")

    backend = DaynestMcpBackend(_session_factory(db_session))

    with pytest.raises(ValueError, match=r"Multiple active Daynest users found.*DAYNEST_USER_EMAIL"):
        backend.whoami()


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


def test_mcp_backend_can_list_medications(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "med-list@example.com")
    db_session.add(
        MedicationPlan(
            user_id=user.id,
            name="Aspirin",
            instructions="Take with water",
            start_date=utc_today,
            schedule_time=time(8, 0),
            every_n_days=1,
            is_active=True,
        )
    )
    db_session.commit()
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    medications = backend.list_medications()

    assert len(medications) == 1
    assert medications[0]["name"] == "Aspirin"
    assert medications[0]["is_active"] is True


def test_mcp_backend_can_create_medication(db_session: Session) -> None:
    user = _create_user(db_session, "med-create@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    result = backend.create_medication(
        name="Vitamin C",
        instructions="Take after lunch",
        start_date="2026-01-01",
        schedule_time="12:00",
        every_n_days=1,
    )

    assert result["name"] == "Vitamin C"
    assert result["instructions"] == "Take after lunch"
    assert result["every_n_days"] == 1
    assert result["is_active"] is True
    assert "id" in result


def test_mcp_backend_can_update_medication(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "med-update@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_medication(
        name="Iron",
        instructions="Take with juice",
        start_date=utc_today.isoformat(),
        schedule_time="08:00",
        every_n_days=1,
    )
    updated = backend.update_medication(
        medication_plan_id=created["id"],
        name="Iron supplement",
        instructions="Take with orange juice",
        start_date=utc_today.isoformat(),
        schedule_time="08:00",
        every_n_days=2,
        is_active=False,
    )

    assert updated["name"] == "Iron supplement"
    assert updated["every_n_days"] == 2
    assert updated["is_active"] is False


def test_mcp_backend_update_medication_raises_for_missing_plan(db_session: Session) -> None:
    user = _create_user(db_session, "med-update-missing@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    with pytest.raises(ValueError, match="not found"):
        backend.update_medication(
            medication_plan_id=9999,
            name="Ghost",
            instructions="N/A",
            start_date="2026-01-01",
            schedule_time="09:00",
        )


def test_mcp_backend_can_delete_medication(db_session: Session) -> None:
    user = _create_user(db_session, "med-delete@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_medication(
        name="Zinc",
        instructions="Take with food",
        start_date="2026-01-01",
        schedule_time="20:00",
    )
    result = backend.delete_medication(created["id"])
    remaining = backend.list_medications()

    assert result["deleted"] is True
    assert result["medication_plan_id"] == created["id"]
    assert remaining == []


def test_mcp_backend_delete_medication_raises_for_missing_plan(db_session: Session) -> None:
    user = _create_user(db_session, "med-delete-missing@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    with pytest.raises(ValueError, match="not found"):
        backend.delete_medication(9999)


def test_integration_key_token_verifier_accepts_mcp_scoped_key(db_session: Session) -> None:
    user = _create_user(db_session, "token@example.com")
    client = _create_integration_client(db_session, user, raw_key="daynest_valid_key")
    verifier = IntegrationKeyTokenVerifier(_session_factory(db_session), resource_server_url="https://daynest.example.com/mcp")

    token = asyncio.run(verifier.verify_token("daynest_valid_key"))

    assert token is not None
    assert token.client_id == str(client.id)
    assert token.auth_source == "integration"
    assert token.integration_client_id == client.id
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
    access_token = DaynestMcpAccessToken(
        token="token",
        client_id=str(client.id),
        scopes=["mcp:read"],
        auth_source="integration",
        integration_client_id=client.id,
    )

    monkeypatch.setattr("app.mcp_server.get_access_token", lambda: access_token)

    whoami = backend.whoami()

    assert whoami["email"] == "auth-owner@example.com"


def test_mcp_backend_resolves_oidc_numeric_subject(db_session: Session, monkeypatch) -> None:
    user = _create_user(db_session, "numeric-oidc@example.com")
    user.oidc_subject = "123456"
    db_session.commit()
    backend = DaynestMcpBackend(_session_factory(db_session))
    access_token = DaynestMcpAccessToken(
        token="token",
        client_id="123456",
        scopes=["mcp:read"],
        auth_source="oidc",
        oidc_subject="123456",
    )

    monkeypatch.setattr("app.mcp_server.get_access_token", lambda: access_token)

    whoami = backend.whoami()

    assert whoami["email"] == "numeric-oidc@example.com"


def test_mcp_backend_rejects_authenticated_token_without_client_id(db_session: Session, monkeypatch) -> None:
    _create_user(db_session, "missing-subject@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session))

    access_token = DaynestMcpAccessToken(token="token", client_id="", scopes=["mcp:read"], auth_source="oidc")

    monkeypatch.setattr("app.mcp_server.get_access_token", lambda: access_token)

    with pytest.raises(ValueError, match="missing a subject"):
        backend.whoami()


def test_oidc_mcp_token_verifier_uses_scope_claim(db_session: Session, monkeypatch) -> None:
    async def decode_oidc_token(_token: str) -> dict[str, str]:
        return {
            "sub": "oidc-subject",
            "email": "oidc@example.com",
            "scope": "openid profile mcp:read",
        }

    monkeypatch.setattr("app.core.oidc.decode_oidc_token", decode_oidc_token)
    verifier = OIDCMcpTokenVerifier(_session_factory(db_session), resource_server_url="https://daynest.example.com/mcp")

    token = asyncio.run(verifier.verify_token("oidc-token"))

    assert token is not None
    assert token.auth_source == "oidc"
    assert token.oidc_subject == "oidc-subject"
    assert token.scopes == ["openid", "profile", "mcp:read"]


def test_oidc_mcp_token_verifier_accepts_resource_audience(db_session: Session, monkeypatch) -> None:
    async def decode_oidc_token(_token: str) -> dict[str, str | list[str]]:
        return {
            "sub": "aud-subject",
            "email": "aud@example.com",
            "scp": ["openid"],
            "aud": ["https://daynest.example.com/mcp"],
        }

    monkeypatch.setattr("app.core.oidc.decode_oidc_token", decode_oidc_token)
    verifier = OIDCMcpTokenVerifier(_session_factory(db_session), resource_server_url="https://daynest.example.com/mcp")

    token = asyncio.run(verifier.verify_token("oidc-token"))

    assert token is not None
    assert token.scopes == ["openid", "mcp:read"]


def test_oidc_mcp_token_verifier_rejects_unscoped_token(db_session: Session, monkeypatch) -> None:
    async def decode_oidc_token(_token: str) -> dict[str, str]:
        return {
            "sub": "unscoped-subject",
            "email": "unscoped@example.com",
            "scope": "openid profile",
            "aud": "daynest",
        }

    monkeypatch.setattr("app.core.oidc.decode_oidc_token", decode_oidc_token)
    verifier = OIDCMcpTokenVerifier(_session_factory(db_session), resource_server_url="https://daynest.example.com/mcp")

    token = asyncio.run(verifier.verify_token("oidc-token"))

    assert token is None


def test_mcp_backend_can_list_routines(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "routine-list@example.com")
    db_session.add(
        RoutineTemplate(
            user_id=user.id,
            name="Morning stretch",
            description="5 min stretch",
            start_date=utc_today,
            every_n_days=1,
            due_time=time(7, 30),
            is_active=True,
        )
    )
    db_session.commit()
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    routines = backend.list_routines()

    assert len(routines) == 1
    assert routines[0]["name"] == "Morning stretch"
    assert routines[0]["due_time"] == "07:30:00"
    assert routines[0]["is_active"] is True


def test_mcp_backend_can_create_routine(db_session: Session) -> None:
    user = _create_user(db_session, "routine-create@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    result = backend.create_routine(
        name="Evening walk",
        start_date="2026-01-01",
        every_n_days=1,
        description="30 min walk",
        due_time="19:00",
    )

    assert result["name"] == "Evening walk"
    assert result["description"] == "30 min walk"
    assert result["every_n_days"] == 1
    assert result["due_time"] == "19:00:00"
    assert result["is_active"] is True
    assert "id" in result


def test_mcp_backend_can_update_routine(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "routine-update@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_routine(
        name="Morning run",
        start_date=utc_today.isoformat(),
        every_n_days=1,
    )
    updated = backend.update_routine(
        routine_template_id=created["id"],
        name="Morning jog",
        start_date=utc_today.isoformat(),
        every_n_days=2,
        is_active=False,
    )

    assert updated["name"] == "Morning jog"
    assert updated["every_n_days"] == 2
    assert updated["is_active"] is False
    assert updated["due_time"] is None


def test_mcp_backend_update_routine_raises_for_missing_template(db_session: Session) -> None:
    user = _create_user(db_session, "routine-update-missing@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    with pytest.raises(ValueError, match="not found"):
        backend.update_routine(routine_template_id=9999, name="Ghost", start_date="2026-01-01")


def test_mcp_backend_can_delete_routine(db_session: Session) -> None:
    user = _create_user(db_session, "routine-delete@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_routine(name="Yoga", start_date="2026-01-01")
    result = backend.delete_routine(created["id"])
    remaining = backend.list_routines()

    assert result["deleted"] is True
    assert result["routine_template_id"] == created["id"]
    assert remaining == []


def test_mcp_backend_delete_routine_raises_for_missing_template(db_session: Session) -> None:
    user = _create_user(db_session, "routine-delete-missing@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    with pytest.raises(ValueError, match="not found"):
        backend.delete_routine(9999)


def test_mcp_backend_can_list_chore_templates(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "chore-list@example.com")
    db_session.add(
        ChoreTemplate(
            user_id=user.id,
            name="Clean bathroom",
            description=None,
            start_date=utc_today,
            every_n_days=7,
            is_active=True,
        )
    )
    db_session.commit()
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    chores = backend.list_chore_templates()

    assert len(chores) == 1
    assert chores[0]["name"] == "Clean bathroom"
    assert chores[0]["every_n_days"] == 7
    assert chores[0]["is_active"] is True


def test_mcp_backend_can_create_chore_template(db_session: Session) -> None:
    user = _create_user(db_session, "chore-create@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    result = backend.create_chore_template(
        name="Mop floors",
        start_date="2026-01-01",
        every_n_days=14,
        description="Downstairs only",
    )

    assert result["name"] == "Mop floors"
    assert result["description"] == "Downstairs only"
    assert result["every_n_days"] == 14
    assert result["is_active"] is True
    assert "id" in result


def test_mcp_backend_can_update_chore_template(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "chore-update@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_chore_template(
        name="Vacuum",
        start_date=utc_today.isoformat(),
        every_n_days=7,
    )
    updated = backend.update_chore_template(
        chore_template_id=created["id"],
        name="Vacuum all rooms",
        start_date=utc_today.isoformat(),
        every_n_days=14,
        is_active=False,
    )

    assert updated["name"] == "Vacuum all rooms"
    assert updated["every_n_days"] == 14
    assert updated["is_active"] is False


def test_mcp_backend_update_chore_template_raises_for_missing(db_session: Session) -> None:
    user = _create_user(db_session, "chore-update-missing@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    with pytest.raises(ValueError, match="not found"):
        backend.update_chore_template(chore_template_id=9999, name="Ghost", start_date="2026-01-01")


def test_mcp_backend_can_delete_chore_template(db_session: Session) -> None:
    user = _create_user(db_session, "chore-delete@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_chore_template(name="Take out recycling", start_date="2026-01-01")
    result = backend.delete_chore_template(created["id"])
    remaining = backend.list_chore_templates()

    assert result["deleted"] is True
    assert result["chore_template_id"] == created["id"]
    assert remaining == []


def test_mcp_backend_delete_chore_template_raises_for_missing(db_session: Session) -> None:
    user = _create_user(db_session, "chore-delete-missing@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    with pytest.raises(ValueError, match="not found"):
        backend.delete_chore_template(9999)


def test_create_mcp_server_uses_backend_session_factory(db_session: Session) -> None:
    session_factory = _session_factory(db_session)
    backend = DaynestMcpBackend(session_factory)

    mcp = create_mcp_server(backend)

    token_verifier = mcp._token_verifier  # noqa: SLF001
    assert token_verifier is not None
    assert [verifier.session_factory for verifier in token_verifier._verifiers] == [session_factory, session_factory]  # noqa: SLF001
