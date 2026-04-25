from datetime import date, time

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.integration_auth import hash_integration_key
from app.core.tokens import create_access_token
from app.models.chore_instance import ChoreInstance, ChoreStatus
from app.models.chore_template import ChoreTemplate
from app.models.integration_client import IntegrationClient
from app.models.medication_plan import MedicationPlan
from app.models.planned_item import PlannedItem
from app.models.user import User


def _create_user(db_session: Session, email: str) -> User:
    user = User(email=email, full_name="Integration User", password_hash="hashed-password", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_integration_key(
    db_session: Session,
    user_id: int,
    *,
    scopes: str,
    rate_limit_per_minute: int = 120,
) -> str:
    raw_key = f"daynest_test_{user_id}_{scopes.replace(':', '_')}"
    client = IntegrationClient(
        user_id=user_id,
        name="test-integration",
        key_hash=hash_integration_key(raw_key),
        scopes_csv=scopes,
        rate_limit_per_minute=rate_limit_per_minute,
    )
    db_session.add(client)
    db_session.commit()
    return raw_key


def test_create_integration_client_and_list(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "client-create@example.com")
    token = create_access_token(user_id=user.id, email=user.email)

    create_response = client.post(
        "/api/v1/integrations/clients",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Home Assistant", "scopes": ["ha:read", "mcp:read"], "rate_limit_per_minute": 80},
    )
    assert create_response.status_code == 200
    payload = create_response.json()
    assert payload["api_key"].startswith("daynest_")
    assert payload["scopes"] == ["ha:read", "mcp:read"]

    list_response = client.get("/api/v1/integrations/clients", headers={"Authorization": f"Bearer {token}"})
    assert list_response.status_code == 200
    assert list_response.json()[0]["name"] == "Home Assistant"


def test_home_assistant_requires_scope_and_returns_entities(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "ha-scope@example.com")
    template = ChoreTemplate(
        user_id=user.id,
        name="Trash Template",
        description=None,
        start_date=date.today(),
        every_n_days=1,
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)
    db_session.add(
        ChoreInstance(
            user_id=user.id,
            chore_template_id=template.id,
            title="Trash",
            scheduled_date=date.today(),
            status=ChoreStatus.pending,
        )
    )
    db_session.add(
        MedicationPlan(
            user_id=user.id,
            name="Vitamin D",
            instructions="With breakfast",
            start_date=date.today(),
            schedule_time=time(8, 0),
            every_n_days=1,
            is_active=True,
        )
    )
    db_session.commit()

    wrong_key = _create_integration_key(db_session, user.id, scopes="mcp:read")
    denied = client.get("/api/v1/integrations/home-assistant/entities", headers={"X-Integration-Key": wrong_key})
    assert denied.status_code == 403

    key = _create_integration_key(db_session, user.id, scopes="ha:read")
    response = client.get("/api/v1/integrations/home-assistant/entities", headers={"X-Integration-Key": key})
    assert response.status_code == 200
    assert response.json()[0]["entity_id"] == "todo.daynest_tasks"


def test_mcp_adapter_and_rate_limit(client: TestClient, db_session: Session) -> None:
    import app.api.dependencies.integration_auth as auth_dep
    auth_dep._request_log.clear()

    user = _create_user(db_session, "mcp-rate@example.com")
    db_session.add(
        PlannedItem(
            user_id=user.id,
            title="Weekly planning",
            planned_for=date.today(),
            notes="sync",
            is_done=False,
        )
    )
    db_session.commit()
    key = _create_integration_key(db_session, user.id, scopes="mcp:read", rate_limit_per_minute=1)

    first = client.get("/api/v1/mcp/today", headers={"X-Integration-Key": key})
    assert first.status_code == 200
    assert len(first.json()["planned"]) == 1

    second = client.get("/api/v1/mcp/today", headers={"X-Integration-Key": key})
    assert second.status_code == 429
