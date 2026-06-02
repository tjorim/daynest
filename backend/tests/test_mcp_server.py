import asyncio
from hashlib import sha256
from datetime import datetime, time, timedelta, timezone

import pytest
from fastmcp.server.auth import AccessToken

from sqlalchemy.orm import Session, sessionmaker

from app.api.dependencies.integration_auth import hash_integration_key
from app.core.config import settings
from app.core.enums import ChoreStatus
from app.mcp_server import DaynestMcpBackend, IntegrationKeyTokenVerifier, create_mcp_server
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.integration_client import IntegrationClient
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.medication_plan import MedicationPlan
from app.models.routine_template import RoutineTemplate
from app.models.user import User
from app.core.enums import MedicationDoseStatus


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
    rate_limit_per_minute: int = 50,
) -> IntegrationClient:
    client = IntegrationClient(
        user_id=user.id,
        name="MCP Client",
        key_hash=hash_integration_key(raw_key),
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
        time_of_day="10:00",
        duration_minutes=30,
        notes="Milk and eggs",
        module_key="shopping_list",
    )
    updated = backend.update_planned_item(
        planned_item_id=created["id"],
        title="Pick up groceries",
        planned_for="2026-04-25",
        time_of_day="11:15",
        duration_minutes=45,
        is_done=True,
        notes="Milk and eggs",
        module_key="shopping_list",
    )

    assert created["title"] == "Pick up groceries"
    assert created["time_of_day"] == "10:00:00"
    assert created["duration_minutes"] == 30
    assert updated["is_done"] is True
    assert updated["time_of_day"] == "11:15:00"
    assert updated["duration_minutes"] == 45


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


def test_mcp_backend_can_get_medication_history(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "med-history@example.com")
    plan = MedicationPlan(
        user_id=user.id,
        name="Vitamin D",
        instructions="Take with breakfast",
        start_date=utc_today,
        schedule_time=time(8, 0),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)
    dose = MedicationDoseInstance(
        user_id=user.id,
        medication_plan_id=plan.id,
        name=plan.name,
        instructions=plan.instructions,
        scheduled_date=utc_today - timedelta(days=1),
        scheduled_at=datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc),
        status=MedicationDoseStatus.taken,
    )
    db_session.add(dose)
    db_session.commit()
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    history = backend.get_medication_history()

    assert history["history"][0]["medication_plan_id"] == plan.id
    assert history["history"][0]["name"] == "Vitamin D"
    assert history["history"][0]["status"] == "taken"


def test_mcp_backend_can_get_scheduling_suggestions(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "mcp-suggestions@example.com")
    chore_template = ChoreTemplate(
        user_id=user.id,
        name="Bathroom cleaning",
        description=None,
        start_date=utc_today - timedelta(days=21),
        every_n_days=7,
        is_active=True,
    )
    db_session.add(chore_template)
    db_session.commit()
    db_session.refresh(chore_template)

    db_session.add_all(
        [
            ChoreInstance(
                user_id=user.id,
                chore_template_id=chore_template.id,
                title=chore_template.name,
                scheduled_date=utc_today - timedelta(days=14),
                status=ChoreStatus.skipped,
            ),
            ChoreInstance(
                user_id=user.id,
                chore_template_id=chore_template.id,
                title=chore_template.name,
                scheduled_date=utc_today - timedelta(days=7),
                status=ChoreStatus.skipped,
            ),
        ]
    )
    db_session.commit()

    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)
    payload = backend.get_scheduling_suggestions(utc_today.isoformat())

    assert payload["for_date"] == utc_today.isoformat()
    assert any(item["suggestion_type"] == "chore_reschedule" for item in payload["suggestions"])


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


def test_mcp_backend_can_list_integration_clients(db_session: Session) -> None:
    user = _create_user(db_session, "integration-list@example.com")
    _create_integration_client(db_session, user, raw_key="daynest_existing_key")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    clients = backend.list_integration_clients()

    assert len(clients) == 1
    assert clients[0]["name"] == "MCP Client"
    assert clients[0]["is_active"] is True


def test_integration_key_hash_is_not_plain_sha256() -> None:
    raw_key = "daynest_secret_key"

    assert hash_integration_key(raw_key) != sha256(raw_key.encode("utf-8")).hexdigest()


def test_mcp_backend_can_create_integration_client(db_session: Session) -> None:
    user = _create_user(db_session, "integration-create@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_integration_client(name="Mobile automation", rate_limit_per_minute=120)
    clients = backend.list_integration_clients()
    verifier = IntegrationKeyTokenVerifier(_session_factory(db_session))
    token = asyncio.run(verifier.verify_token(created["api_key"]))

    assert created["name"] == "Mobile automation"
    assert created["api_key"].startswith("daynest_")
    assert clients[0]["id"] == created["id"]
    assert token is not None


def test_integration_token_cannot_create_integration_client(db_session: Session, monkeypatch) -> None:
    user = _create_user(db_session, "integration-blocked@example.com")
    client = _create_integration_client(db_session, user, raw_key="daynest_blocked_key")
    backend = DaynestMcpBackend(_session_factory(db_session))
    access_token = AccessToken(
        token="daynest_blocked_key",
        client_id=str(client.id),
        scopes=[],
        claims={"auth_source": "integration", "integration_client_id": client.id},
    )

    monkeypatch.setattr("app.mcp_server.get_access_token", lambda: access_token)

    with pytest.raises(PermissionError, match="Integration tokens cannot create new integration clients"):
        backend.create_integration_client(name="Sneaky client")


def test_integration_key_token_verifier_accepts_valid_key(db_session: Session) -> None:
    user = _create_user(db_session, "token@example.com")
    client = _create_integration_client(db_session, user, raw_key="daynest_valid_key")
    verifier = IntegrationKeyTokenVerifier(_session_factory(db_session), resource_server_url="https://daynest.example.com/mcp")

    token = asyncio.run(verifier.verify_token("daynest_valid_key"))

    assert token is not None
    assert token.client_id == str(client.id)
    assert token.claims.get("auth_source") == "integration"
    assert token.claims.get("integration_client_id") == client.id


def test_mcp_backend_uses_authenticated_integration_owner(db_session: Session, monkeypatch) -> None:
    user = _create_user(db_session, "auth-owner@example.com")
    client = _create_integration_client(db_session, user, raw_key="daynest_auth_owner")
    backend = DaynestMcpBackend(_session_factory(db_session))
    access_token = AccessToken(
        token="token",
        client_id=str(client.id),
        scopes=[],
        claims={
            "auth_source": "integration",
            "integration_client_id": client.id,
        },
    )

    monkeypatch.setattr("app.mcp_server.get_access_token", lambda: access_token)

    whoami = backend.whoami()

    assert whoami["email"] == "auth-owner@example.com"


def test_mcp_backend_resolves_oidc_numeric_subject(db_session: Session, monkeypatch) -> None:
    user = _create_user(db_session, "numeric-oidc@example.com")
    user.oidc_subject = "123456"
    db_session.commit()
    backend = DaynestMcpBackend(_session_factory(db_session))
    access_token = AccessToken(
        token="token",
        client_id="123456",
        scopes=[],
        claims={"sub": "123456"},
    )

    monkeypatch.setattr("app.mcp_server.get_access_token", lambda: access_token)

    whoami = backend.whoami()

    assert whoami["email"] == "numeric-oidc@example.com"


def test_mcp_backend_rejects_authenticated_token_without_client_id(db_session: Session, monkeypatch) -> None:
    _create_user(db_session, "missing-subject@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session))

    access_token = AccessToken(token="token", client_id="", scopes=[], claims={})

    monkeypatch.setattr("app.mcp_server.get_access_token", lambda: access_token)

    with pytest.raises(ValueError, match="missing a subject"):
        backend.whoami()


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


def test_create_mcp_server_uses_backend_session_factory(db_session: Session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "oidc_issuer_url", None)
    session_factory = _session_factory(db_session)
    backend = DaynestMcpBackend(session_factory)

    mcp = create_mcp_server(backend)

    assert isinstance(mcp.auth, IntegrationKeyTokenVerifier)
    assert mcp.auth.session_factory == session_factory


def test_mcp_server_version_uses_build_version_env(db_session: Session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "oidc_issuer_url", None)
    backend = DaynestMcpBackend(_session_factory(db_session))
    monkeypatch.setenv("BUILD_VERSION", "abc1234")

    mcp = create_mcp_server(backend)

    assert mcp.version == "abc1234"


def test_mcp_server_version_defaults_to_dev_when_build_version_missing(db_session: Session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "oidc_issuer_url", None)
    backend = DaynestMcpBackend(_session_factory(db_session))
    monkeypatch.delenv("BUILD_VERSION", raising=False)

    mcp = create_mcp_server(backend)

    assert mcp.version == "dev"


def test_mcp_backend_create_planned_item_with_priority_and_tags(db_session: Session) -> None:
    user = _create_user(db_session, "planned-priority@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    result = backend.create_planned_item(
        title="Urgent task",
        planned_for="2026-05-25",
        priority="high",
        tags=["work", "important"],
    )

    assert result["title"] == "Urgent task"
    assert result["priority"] == "high"
    assert result["tags"] == ["work", "important"]


def test_mcp_backend_update_planned_item_with_priority_and_tags(db_session: Session) -> None:
    user = _create_user(db_session, "planned-update-priority@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_planned_item(
        title="Task",
        planned_for="2026-05-25",
        notes="original notes",
        tags=["home"],
    )
    updated = backend.update_planned_item(
        planned_item_id=created["id"],
        priority="urgent",
        tags=["urgent-tag"],
    )

    assert updated["priority"] == "urgent"
    assert updated["tags"] == ["urgent-tag"]
    assert updated["title"] == "Task"
    assert updated["planned_for"] == "2026-05-25"
    assert updated["notes"] == "original notes"


def test_mcp_backend_update_planned_item_scope_future(db_session: Session) -> None:
    user = _create_user(db_session, "planned-update-scope@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_planned_item(
        title="Recurring task",
        planned_for="2026-05-25",
        rrule="FREQ=DAILY;COUNT=3",
    )
    updated = backend.update_planned_item(
        planned_item_id=created["id"],
        title="Recurring task updated",
        scope="future",
    )

    assert updated["title"] == "Recurring task updated"


def test_mcp_backend_defer_planned_item(db_session: Session) -> None:
    from datetime import timedelta

    user = _create_user(db_session, "planned-defer@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    created = backend.create_planned_item(
        title="Defer me",
        planned_for="2026-05-25",
        notes="preserve me",
        priority="high",
        tags=["work"],
    )
    result = backend.defer_planned_item(created["id"], days=7)

    expected = (datetime.now(timezone.utc).date() + timedelta(days=7)).isoformat()
    assert result["planned_for"] == expected
    assert result["title"] == "Defer me"
    assert result["notes"] == "preserve me"
    assert result["priority"] == "high"
    assert result["tags"] == ["work"]
    assert result["is_done"] is False


def test_mcp_backend_take_medication_dose_with_custom_taken_at(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "med-take-takenat@example.com")
    plan = MedicationPlan(
        user_id=user.id,
        name="Aspirin",
        instructions="Take with water",
        start_date=utc_today,
        schedule_time=time(8, 0),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)

    past_time = datetime.now(timezone.utc) - timedelta(hours=2)
    dose = MedicationDoseInstance(
        user_id=user.id,
        medication_plan_id=plan.id,
        name=plan.name,
        instructions=plan.instructions,
        scheduled_date=utc_today,
        scheduled_at=datetime(utc_today.year, utc_today.month, utc_today.day, 8, 0, tzinfo=timezone.utc),
        status=MedicationDoseStatus.missed,
    )
    db_session.add(dose)
    db_session.commit()
    db_session.refresh(dose)

    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)
    result = backend.take_medication_dose(dose.id, taken_at=past_time.isoformat())

    assert result["status"] == "taken"
    assert result["taken_at"] is not None


def test_mcp_backend_take_medication_dose_rejects_future_taken_at(db_session: Session) -> None:
    from fastapi import HTTPException

    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "med-take-future@example.com")
    plan = MedicationPlan(
        user_id=user.id,
        name="Vitamin C",
        instructions="Take with juice",
        start_date=utc_today,
        schedule_time=time(9, 0),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)

    dose = MedicationDoseInstance(
        user_id=user.id,
        medication_plan_id=plan.id,
        name=plan.name,
        instructions=plan.instructions,
        scheduled_date=utc_today,
        scheduled_at=datetime(utc_today.year, utc_today.month, utc_today.day, 9, 0, tzinfo=timezone.utc),
        status=MedicationDoseStatus.scheduled,
    )
    db_session.add(dose)
    db_session.commit()
    db_session.refresh(dose)

    future_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    with pytest.raises(HTTPException) as exc_info:
        backend.take_medication_dose(dose.id, taken_at=future_time)
    assert exc_info.value.status_code == 422


def test_mcp_backend_skip_missed_medication_doses(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "med-skip-missed@example.com")
    plan = MedicationPlan(
        user_id=user.id,
        name="Iron",
        instructions="Take with juice",
        start_date=utc_today - timedelta(days=3),
        schedule_time=time(8, 0),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)

    # Two missed doses from the past
    for delta in (1, 2):
        d = utc_today - timedelta(days=delta)
        db_session.add(MedicationDoseInstance(
            user_id=user.id,
            medication_plan_id=plan.id,
            name=plan.name,
            instructions=plan.instructions,
            scheduled_date=d,
            scheduled_at=datetime(d.year, d.month, d.day, 8, 0, tzinfo=timezone.utc),
            status=MedicationDoseStatus.missed,
        ))
    # One scheduled dose for today — should not be touched
    db_session.add(MedicationDoseInstance(
        user_id=user.id,
        medication_plan_id=plan.id,
        name=plan.name,
        instructions=plan.instructions,
        scheduled_date=utc_today,
        scheduled_at=datetime(utc_today.year, utc_today.month, utc_today.day, 8, 0, tzinfo=timezone.utc),
        status=MedicationDoseStatus.scheduled,
    ))
    db_session.commit()

    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)
    result = backend.skip_missed_medication_doses()  # default: before today

    assert result["skipped_count"] == 2
    assert result["before_date"] == utc_today.isoformat()


def test_mcp_backend_skip_missed_doses_does_not_touch_today(db_session: Session) -> None:
    utc_today = datetime.now(timezone.utc).date()
    user = _create_user(db_session, "med-skip-today-safe@example.com")
    plan = MedicationPlan(
        user_id=user.id,
        name="Magnesium",
        instructions="Take at night",
        start_date=utc_today,
        schedule_time=time(22, 0),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)

    # A missed dose for today (edge case — should NOT be skipped by default cutoff)
    db_session.add(MedicationDoseInstance(
        user_id=user.id,
        medication_plan_id=plan.id,
        name=plan.name,
        instructions=plan.instructions,
        scheduled_date=utc_today,
        scheduled_at=datetime(utc_today.year, utc_today.month, utc_today.day, 22, 0, tzinfo=timezone.utc),
        status=MedicationDoseStatus.missed,
    ))
    db_session.commit()

    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)
    result = backend.skip_missed_medication_doses()  # default: before today

    assert result["skipped_count"] == 0


def test_mcp_backend_manages_shopping_lists_and_items(db_session: Session) -> None:
    user = _create_user(db_session, "shopping-mcp@example.com")
    backend = DaynestMcpBackend(_session_factory(db_session), user_email=user.email)

    shopping_list = backend.create_shopping_list(
        "Groceries", store="Market", notes="Weekend shop"
    )
    assert shopping_list["name"] == "Groceries"
    assert shopping_list["store"] == "Market"

    listed = backend.list_shopping_lists()
    assert [item["id"] for item in listed] == [shopping_list["id"]]

    item = backend.add_shopping_item(
        shopping_list_id=shopping_list["id"],
        title="Milk",
        planned_for="2026-06-02",
        tags=["dairy"],
    )
    assert item["module_key"] == "shopping_list"
    assert item["linked_ref"] == str(shopping_list["id"])
    assert item["is_done"] is False

    checked = backend.check_off_shopping_item(
        shopping_list_id=shopping_list["id"], planned_item_id=item["id"]
    )
    assert checked["is_done"] is True
