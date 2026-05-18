from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.integration_auth import hash_integration_key
from app.schemas.integration_contracts import (
    HOME_ASSISTANT_ADAPTER,
    HOME_ASSISTANT_CONTRACT_VERSION,
    INTEGRATION_CONTRACT_HEADER,
    integration_contract_header,
)
from app.core.enums import ChoreStatus
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.integration_client import IntegrationClient
from app.models.user import User


def _create_user(db_session: Session, email: str) -> User:
    user = User(email=email, full_name="Contract User", password_hash="hashed-password", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_integration_key(db_session: Session, user_id: int, *, scopes: str) -> str:
    raw_key = f"daynest_contract_{user_id}_{scopes.replace(':', '_')}"
    client = IntegrationClient(
        user_id=user_id,
        name="contract-test-client",
        key_hash=hash_integration_key(raw_key),
        scopes_csv=scopes,
        rate_limit_per_minute=120,
    )
    db_session.add(client)
    db_session.commit()
    return raw_key


def _setup_contract_chore(db_session: Session, user: User, name: str) -> None:
    template = ChoreTemplate(
        user_id=user.id,
        name=name,
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
            title=name,
            scheduled_date=date.today(),
            status=ChoreStatus.pending,
        )
    )
    db_session.commit()


def test_home_assistant_contract_header_and_summary_shape(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "contract-ha@example.com")
    _setup_contract_chore(db_session, user, "Contract Chore")

    key = _create_integration_key(db_session, user.id, scopes="ha:read")
    response = client.get("/api/v1/integrations/home-assistant/summary", headers={"X-Integration-Key": key})

    assert response.status_code == 200
    assert response.headers[INTEGRATION_CONTRACT_HEADER] == integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)
    payload = response.json()
    assert set(payload.keys()) == {
        "sensor_daynest_chores_due",
        "sensor_daynest_routines_open",
        "sensor_daynest_medication_due",
        "sensor_daynest_planned_remaining",
        "sensor_daynest_overdue_count",
        "sensor_daynest_next_medication",
    }


def test_home_assistant_contract_dashboard_shape(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "contract-ha-dashboard@example.com")
    _setup_contract_chore(db_session, user, "Contract Dashboard Chore")

    key = _create_integration_key(db_session, user.id, scopes="ha:read")
    response = client.get("/api/v1/integrations/home-assistant/dashboard", headers={"X-Integration-Key": key})

    assert response.status_code == 200
    assert response.headers[INTEGRATION_CONTRACT_HEADER] == integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)
    payload = response.json()
    assert set(payload.keys()) == {
        "for_date",
        "due_today_count",
        "overdue_count",
        "planned_count",
        "planned_remaining_count",
        "medication_due_count",
        "completion_ratio",
        "next_medication",
        "routines_open_count",
        "due_today",
        "planned",
    }


def test_home_assistant_contract_entities_shape(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "contract-ha-entities@example.com")
    _setup_contract_chore(db_session, user, "Contract Entities Chore")

    key = _create_integration_key(db_session, user.id, scopes="ha:read")
    response = client.get("/api/v1/integrations/home-assistant/entities", headers={"X-Integration-Key": key})

    assert response.status_code == 200
    assert response.headers[INTEGRATION_CONTRACT_HEADER] == integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)
    payload = response.json()
    assert isinstance(payload, list)
    assert {entity["entity_id"] for entity in payload} == {
        "sensor.daynest_chores_due",
        "sensor.daynest_routines_open",
        "sensor.daynest_medication_due",
        "sensor.daynest_planned_remaining",
        "sensor.daynest_overdue_count",
        "sensor.daynest_completion_ratio",
        "sensor.daynest_next_medication",
    }

    for entity in payload:
        assert set(entity.keys()) == {"entity_id", "state", "attributes"}


def test_home_assistant_contract_calendar_shape(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "contract-ha-calendar@example.com")
    _setup_contract_chore(db_session, user, "Calendar Contract Chore")

    key = _create_integration_key(db_session, user.id, scopes="ha:read")
    today = date.today()
    response = client.get(
        "/api/v1/integrations/home-assistant/calendar",
        params={"start": today.isoformat(), "end": today.isoformat()},
        headers={"X-Integration-Key": key},
    )

    assert response.status_code == 200
    assert response.headers[INTEGRATION_CONTRACT_HEADER] == integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) >= 1
    for event in payload:
        assert set(event.keys()) >= {"uid", "summary", "start", "end"}
        assert isinstance(event["uid"], str)
        assert isinstance(event["summary"], str)
        assert isinstance(event["start"], dict)
        assert isinstance(event["end"], dict)
        assert "date" in event["start"] or "dateTime" in event["start"]
