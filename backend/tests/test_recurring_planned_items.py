from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.main import app
from app.models.planned_item import PlannedItem
from app.models.recurrence_series import RecurrenceSeries
from app.models.user import User


def _create_user(db_session: Session, email: str) -> User:
    user = User(email=email, full_name="Test User", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _auth_as(user: User) -> None:
    async def _dep() -> User:
        return user

    app.dependency_overrides[get_current_user] = _dep


def _clear_auth() -> None:
    app.dependency_overrides.pop(get_current_user, None)


def test_create_planned_item_with_rrule_creates_series_and_first_instance_only(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "planned-rrule@example.com")
    _auth_as(user)
    try:
        response = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Water plants",
                "planned_for": "2026-05-21",
                "rrule": "FREQ=WEEKLY;COUNT=4",
            },
        )
    finally:
        _clear_auth()

    assert response.status_code == 200
    body = response.json()
    assert body["rrule"] == "FREQ=WEEKLY;COUNT=4"

    items = (
        db_session.query(PlannedItem)
        .filter(PlannedItem.user_id == user.id)
        .order_by(PlannedItem.planned_for.asc(), PlannedItem.id.asc())
        .all()
    )
    assert len(items) == 1
    assert all(item.recurrence_series_id is not None for item in items)
    assert len({item.recurrence_series_id for item in items}) == 1
    assert all(item.rrule == "FREQ=WEEKLY;COUNT=4" for item in items)
    series = db_session.query(RecurrenceSeries).filter(RecurrenceSeries.user_id == user.id).one()
    assert series.materialized_through == date(2026, 5, 21)


def test_list_planned_items_materializes_missing_recurrence_instances(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "planned-lazy-materialize@example.com")
    _auth_as(user)
    try:
        create = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Water plants",
                "planned_for": "2026-05-21",
                "rrule": "FREQ=WEEKLY;COUNT=4",
            },
        )
        assert create.status_code == 200

        response = client.get("/api/v1/planned-items?start_date=2026-05-21&end_date=2026-06-30")
    finally:
        _clear_auth()

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 4
    assert [item["planned_for"] for item in payload] == [
        "2026-05-21",
        "2026-05-28",
        "2026-06-04",
        "2026-06-11",
    ]

    items = (
        db_session.query(PlannedItem)
        .filter(PlannedItem.user_id == user.id)
        .order_by(PlannedItem.planned_for.asc(), PlannedItem.id.asc())
        .all()
    )
    assert len(items) == 4

    series = db_session.query(RecurrenceSeries).filter(RecurrenceSeries.user_id == user.id).one()
    assert series.materialized_through == date(9999, 12, 31)


def test_list_planned_items_materialization_is_idempotent(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "planned-lazy-idempotent@example.com")
    _auth_as(user)
    try:
        create = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Daily habit",
                "planned_for": "2026-05-21",
                "rrule": "FREQ=DAILY;COUNT=3",
            },
        )
        assert create.status_code == 200

        first = client.get("/api/v1/planned-items?start_date=2026-05-21&end_date=2026-05-23")
        assert first.status_code == 200
        second = client.get("/api/v1/planned-items?start_date=2026-05-21&end_date=2026-05-23")
    finally:
        _clear_auth()

    assert second.status_code == 200
    assert len(first.json()) == 3
    assert len(second.json()) == 3
    items = db_session.query(PlannedItem).filter(PlannedItem.user_id == user.id).all()
    assert len(items) == 3


def test_create_planned_item_with_invalid_rrule_returns_422(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "planned-invalid-rrule@example.com")
    _auth_as(user)
    try:
        response = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Bad rule",
                "planned_for": "2026-05-21",
                "rrule": "NOT_A_VALID_RRULE",
            },
        )
    finally:
        _clear_auth()

    assert response.status_code == 422


def test_delete_planned_item_scope_future_deletes_series_from_today(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "planned-delete-future@example.com")
    _auth_as(user)
    start = date.today().isoformat()
    try:
        create = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Recurring cleanup",
                "planned_for": start,
                "rrule": "FREQ=DAILY;COUNT=3",
            },
        )
        assert create.status_code == 200
        planned_id = create.json()["id"]
        keep = client.post(
            "/api/v1/planned-items",
            json={
                "title": "One-time cleanup",
                "planned_for": start,
            },
        )
        assert keep.status_code == 200
        keep_id = keep.json()["id"]

        delete = client.delete(f"/api/v1/planned-items/{planned_id}?scope=future")
        assert delete.status_code == 204
    finally:
        _clear_auth()

    remaining = db_session.query(PlannedItem).filter(PlannedItem.user_id == user.id).all()
    assert [item.id for item in remaining] == [keep_id]
