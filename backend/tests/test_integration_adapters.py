from datetime import date, time

from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlalchemy.orm import Session

from app.api.dependencies.integration_auth import hash_integration_key
from app.core.tokens import create_access_token
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
from app.models.medication_plan import MedicationPlan
from app.models.user import User


HOME_ASSISTANT_ENDPOINTS = ("summary", "entities", "dashboard")
FIXED_TODAY = date(2026, 1, 15)


class FrozenDate(date):
    @classmethod
    def today(cls) -> date:
        return FIXED_TODAY


def _freeze_route_today(monkeypatch: MonkeyPatch, route_module: str) -> None:
    monkeypatch.setattr(f"{route_module}.date", FrozenDate)


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


def _create_home_assistant_fixture(db_session: Session, email: str) -> User:
    user = _create_user(db_session, email)
    template = ChoreTemplate(
        user_id=user.id,
        name="Home Assistant Template",
        description=None,
        start_date=FIXED_TODAY,
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
            title="Home Assistant Chore",
            scheduled_date=FIXED_TODAY,
            status=ChoreStatus.pending,
        )
    )
    db_session.add(
        MedicationPlan(
            user_id=user.id,
            name="Omega-3",
            instructions="With lunch",
            start_date=FIXED_TODAY,
            schedule_time=time(12, 0),
            every_n_days=1,
            is_active=True,
        )
    )
    db_session.commit()
    return user


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


def test_home_assistant_routes_enforce_ha_read_scope(
    client: TestClient,
    db_session: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    _freeze_route_today(monkeypatch, "app.api.routes.integrations.home_assistant")
    user = _create_home_assistant_fixture(db_session, "ha-scope@example.com")
    wrong_key = _create_integration_key(db_session, user.id, scopes="mcp:read")

    for endpoint in HOME_ASSISTANT_ENDPOINTS:
        denied = client.get(
            f"/api/v1/integrations/home-assistant/{endpoint}",
            headers={"X-Integration-Key": wrong_key},
        )
        assert denied.status_code == 403


def test_home_assistant_summary_contract_is_stable(
    client: TestClient,
    db_session: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    _freeze_route_today(monkeypatch, "app.api.routes.integrations.home_assistant")
    user = _create_home_assistant_fixture(db_session, "ha-summary-contract@example.com")
    ha_key = _create_integration_key(db_session, user.id, scopes="ha:read")
    expected_contract = integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)

    summary = client.get("/api/v1/integrations/home-assistant/summary", headers={"X-Integration-Key": ha_key})
    assert summary.status_code == 200
    assert summary.headers[INTEGRATION_CONTRACT_HEADER] == expected_contract
    summary_payload = summary.json()
    assert set(summary_payload.keys()) == {
        "todo_daynest_today",
        "sensor_daynest_overdue_count",
        "sensor_daynest_next_medication",
    }
    assert isinstance(summary_payload["todo_daynest_today"], int)
    assert isinstance(summary_payload["sensor_daynest_overdue_count"], int)
    assert summary_payload["sensor_daynest_next_medication"] is None or isinstance(
        summary_payload["sensor_daynest_next_medication"],
        str,
    )


def test_home_assistant_entities_contract_is_stable(
    client: TestClient,
    db_session: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    _freeze_route_today(monkeypatch, "app.api.routes.integrations.home_assistant")
    user = _create_home_assistant_fixture(db_session, "ha-entities-contract@example.com")
    ha_key = _create_integration_key(db_session, user.id, scopes="ha:read")
    expected_contract = integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)

    entities = client.get("/api/v1/integrations/home-assistant/entities", headers={"X-Integration-Key": ha_key})
    assert entities.status_code == 200
    assert entities.headers[INTEGRATION_CONTRACT_HEADER] == expected_contract
    entities_payload = entities.json()
    assert isinstance(entities_payload, list)
    expected_entity_ids = {
        "todo.daynest_tasks",
        "sensor.daynest_overdue_count",
        "sensor.daynest_completion_ratio",
        "sensor.daynest_next_medication",
    }
    assert {item["entity_id"] for item in entities_payload} == expected_entity_ids
    for item in entities_payload:
        assert set(item.keys()) == {"entity_id", "state", "attributes"}
        assert isinstance(item["state"], str)
        assert isinstance(item["attributes"], dict)


def test_home_assistant_dashboard_contract_is_stable(
    client: TestClient,
    db_session: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    _freeze_route_today(monkeypatch, "app.api.routes.integrations.home_assistant")
    user = _create_home_assistant_fixture(db_session, "ha-dashboard-contract@example.com")
    ha_key = _create_integration_key(db_session, user.id, scopes="ha:read")
    expected_contract = integration_contract_header(HOME_ASSISTANT_ADAPTER, HOME_ASSISTANT_CONTRACT_VERSION)

    dashboard = client.get("/api/v1/integrations/home-assistant/dashboard", headers={"X-Integration-Key": ha_key})
    assert dashboard.status_code == 200
    assert dashboard.headers[INTEGRATION_CONTRACT_HEADER] == expected_contract
    dashboard_payload = dashboard.json()
    assert set(dashboard_payload.keys()) == {
        "for_date",
        "overdue_count",
        "due_today_count",
        "planned_count",
        "medication_due_count",
        "completion_ratio",
        "next_medication",
    }
    assert isinstance(dashboard_payload["for_date"], str)
    assert isinstance(dashboard_payload["overdue_count"], int)
    assert isinstance(dashboard_payload["due_today_count"], int)
    assert isinstance(dashboard_payload["planned_count"], int)
    assert isinstance(dashboard_payload["medication_due_count"], int)
    assert isinstance(dashboard_payload["completion_ratio"], float)
    assert dashboard_payload["next_medication"] is None or isinstance(dashboard_payload["next_medication"], str)


def test_home_assistant_write_endpoints_require_ha_write_scope(
    client: TestClient,
    db_session: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    _freeze_route_today(monkeypatch, "app.api.routes.integrations.home_assistant")
    user = _create_home_assistant_fixture(db_session, "ha-write-scope-denied@example.com")
    read_only_key = _create_integration_key(db_session, user.id, scopes="ha:read")

    for path, payload in [
        ("/api/v1/integrations/home-assistant/actions/complete-task", {"task_id": 1}),
        ("/api/v1/integrations/home-assistant/actions/snooze-task", {"task_id": 1}),
        ("/api/v1/integrations/home-assistant/actions/mark-medication-taken", {"medication_dose_id": 1}),
    ]:
        denied = client.post(path, json=payload, headers={"X-Integration-Key": read_only_key})
        assert denied.status_code == 403, f"Expected 403 for {path} with ha:read scope"


def test_home_assistant_complete_task_marks_chore_complete(
    client: TestClient,
    db_session: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    _freeze_route_today(monkeypatch, "app.api.routes.integrations.home_assistant")
    user = _create_home_assistant_fixture(db_session, "ha-complete-task@example.com")
    write_key = _create_integration_key(db_session, user.id, scopes="ha:write")

    chore = db_session.query(ChoreInstance).filter_by(user_id=user.id).first()
    assert chore is not None
    assert chore.status == ChoreStatus.pending

    response = client.post(
        "/api/v1/integrations/home-assistant/actions/complete-task",
        json={"task_id": chore.id},
        headers={"X-Integration-Key": write_key},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert str(chore.id) in payload["detail"]

    db_session.refresh(chore)
    assert chore.status == ChoreStatus.completed


def test_home_assistant_snooze_task_reschedules_chore(
    client: TestClient,
    db_session: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    _freeze_route_today(monkeypatch, "app.api.routes.integrations.home_assistant")
    user = _create_home_assistant_fixture(db_session, "ha-snooze-task@example.com")
    write_key = _create_integration_key(db_session, user.id, scopes="ha:write")

    chore = db_session.query(ChoreInstance).filter_by(user_id=user.id).first()
    assert chore is not None

    response = client.post(
        "/api/v1/integrations/home-assistant/actions/snooze-task",
        json={"task_id": chore.id, "days": 2},
        headers={"X-Integration-Key": write_key},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert "2 day(s)" in payload["detail"]

    db_session.refresh(chore)
    assert chore.scheduled_date == FIXED_TODAY + date.resolution * 2


def test_home_assistant_mark_medication_taken(
    client: TestClient,
    db_session: Session,
    monkeypatch: MonkeyPatch,
) -> None:
    from datetime import datetime, timezone

    from app.core.enums import MedicationDoseStatus
    from app.models.medication_dose_instance import MedicationDoseInstance

    _freeze_route_today(monkeypatch, "app.api.routes.integrations.home_assistant")
    user = _create_home_assistant_fixture(db_session, "ha-mark-medication@example.com")
    write_key = _create_integration_key(db_session, user.id, scopes="ha:write")

    # Retrieve the medication plan created by the fixture
    from app.models.medication_plan import MedicationPlan

    plan = db_session.query(MedicationPlan).filter_by(user_id=user.id).first()
    assert plan is not None

    # Create a dose instance in scheduled status directly (avoids missed-marking by dashboard)
    future_scheduled_at = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
    dose = MedicationDoseInstance(
        user_id=user.id,
        medication_plan_id=plan.id,
        name=plan.name,
        instructions=plan.instructions,
        scheduled_date=FIXED_TODAY,
        scheduled_at=future_scheduled_at,
        status=MedicationDoseStatus.scheduled,
    )
    db_session.add(dose)
    db_session.commit()
    db_session.refresh(dose)

    response = client.post(
        "/api/v1/integrations/home-assistant/actions/mark-medication-taken",
        json={"medication_dose_id": dose.id},
        headers={"X-Integration-Key": write_key},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert str(dose.id) in payload["detail"]

    db_session.refresh(dose)
    assert dose.status == MedicationDoseStatus.taken
