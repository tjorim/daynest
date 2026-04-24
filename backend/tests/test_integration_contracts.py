from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.integration_auth import hash_integration_key
from app.schemas.integration_contracts import (
    HOME_ASSISTANT_ADAPTER,
    HOME_ASSISTANT_CONTRACT_VERSION,
    INTEGRATION_CONTRACT_HEADER,
    MCP_ADAPTER,
    MCP_CONTRACT_VERSION,
    integration_contract_header,
)
from app.models.chore_instance import ChoreInstance, ChoreStatus
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


def test_home_assistant_contract_header_and_summary_shape(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "contract-ha@example.com")

    template = ChoreTemplate(
        user_id=user.id,
        name="Contract Chore",
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
            title="Contract Chore",
            scheduled_date=date.today(),
            status=ChoreStatus.pending,
        )
    )
    db_session.commit()

    key = _create_integration_key(db_session, user.id, scopes="ha:read")
    response = client.get("/api/v1/integrations/home-assistant/summary", headers={"X-Integration-Key": key})

    assert response.status_code == 200
    assert response.headers[INTEGRATION_CONTRACT_HEADER] == integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)
    payload = response.json()
    assert set(payload.keys()) == {
        "todo_daynest_today",
        "sensor_daynest_overdue_count",
        "sensor_daynest_next_medication",
    }


def test_mcp_contract_headers_and_core_today_keys(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "contract-mcp@example.com")
    key = _create_integration_key(db_session, user.id, scopes="mcp:read")

    capabilities = client.get("/api/v1/mcp/capabilities", headers={"X-Integration-Key": key})
    assert capabilities.status_code == 200
    assert capabilities.headers[INTEGRATION_CONTRACT_HEADER] == integration_contract_header(MCP_ADAPTER, MCP_CONTRACT_VERSION)

    today = client.get("/api/v1/mcp/today", headers={"X-Integration-Key": key})
    assert today.status_code == 200
    assert today.headers[INTEGRATION_CONTRACT_HEADER] == integration_contract_header(MCP_ADAPTER, MCP_CONTRACT_VERSION)

    payload = today.json()
    assert set(payload.keys()) == {
        "medication",
        "medication_history",
        "routines",
        "overdue",
        "due_today",
        "upcoming",
        "planned",
        "day_items",
    }
