from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.main import app
from app.models.planned_item import PlannedItem
from app.models.recurrence_series import RecurrenceSeries
from app.models.user import User
from app.repositories.today_repository import TodayRepository


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


def test_recurrence_series_query_excludes_already_materialized_windows(db_session: Session) -> None:
    user = _create_user(db_session, "planned-query-filter@example.com")
    pending = RecurrenceSeries(
        user_id=user.id,
        title="Pending",
        rrule="FREQ=DAILY",
        start_date=date(2026, 5, 21),
        materialized_through=date(2026, 5, 27),
    )
    covered = RecurrenceSeries(
        user_id=user.id,
        title="Covered",
        rrule="FREQ=DAILY",
        start_date=date(2026, 5, 21),
        materialized_through=date(2026, 5, 28),
    )
    never_materialized = RecurrenceSeries(
        user_id=user.id,
        title="Never materialized",
        rrule="FREQ=DAILY",
        start_date=date(2026, 5, 21),
        materialized_through=None,
    )
    db_session.add_all([pending, covered, never_materialized])
    db_session.commit()

    series = TodayRepository(db_session).list_recurrence_series_overlapping(
        user_id=user.id,
        through_date=date(2026, 5, 28),
    )

    assert {item.title for item in series} == {"Pending", "Never materialized"}


def test_sparse_recurrence_is_not_marked_exhausted_before_next_occurrence(
    client: TestClient,
    db_session: Session,
) -> None:
    user = _create_user(db_session, "planned-lazy-sparse@example.com")
    _auth_as(user)
    try:
        create = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Weekly review",
                "planned_for": "2026-05-21",
                "rrule": "FREQ=WEEKLY;COUNT=4",
            },
        )
        assert create.status_code == 200

        before_next = client.get("/api/v1/planned-items?start_date=2026-05-21&end_date=2026-05-27")
        assert before_next.status_code == 200
        after_next = client.get("/api/v1/planned-items?start_date=2026-05-21&end_date=2026-05-28")
    finally:
        _clear_auth()

    assert after_next.status_code == 200
    assert [item["planned_for"] for item in before_next.json()] == ["2026-05-21"]
    assert [item["planned_for"] for item in after_next.json()] == ["2026-05-21", "2026-05-28"]

    series = db_session.query(RecurrenceSeries).filter(RecurrenceSeries.user_id == user.id).one()
    assert series.materialized_through == date(2026, 5, 28)


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


def test_update_planned_item_scope_future_updates_template_and_clears_materialized_future(
    client: TestClient,
    db_session: Session,
) -> None:
    user = _create_user(db_session, "planned-update-future@example.com")
    _auth_as(user)
    start = date.today()
    end = start + (date.resolution * 3)
    try:
        create = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Recurring cleanup",
                "planned_for": start.isoformat(),
                "rrule": "FREQ=DAILY;COUNT=4",
            },
        )
        assert create.status_code == 200
        planned_id = create.json()["id"]
        listed = client.get(
            f"/api/v1/planned-items?start_date={start.isoformat()}&end_date={end.isoformat()}"
        )
        assert listed.status_code == 200

        update = client.put(
            f"/api/v1/planned-items/{planned_id}?scope=future",
            json={
                "title": "Recurring cleanup updated",
                "planned_for": start.isoformat(),
                "is_done": False,
                "rrule": "FREQ=DAILY;COUNT=4",
            },
        )
    finally:
        _clear_auth()

    assert update.status_code == 200
    assert update.json()["title"] == "Recurring cleanup updated"

    series = db_session.query(RecurrenceSeries).filter(RecurrenceSeries.user_id == user.id).one()
    assert series.title == "Recurring cleanup updated"
    assert series.materialized_through == start - date.resolution

    remaining = (
        db_session.query(PlannedItem)
        .filter(PlannedItem.user_id == user.id, PlannedItem.recurrence_series_id == series.id)
        .all()
    )
    assert [item.id for item in remaining] == [planned_id]


def test_update_planned_item_scope_all_updates_template_and_clears_materialized_series(
    client: TestClient,
    db_session: Session,
) -> None:
    user = _create_user(db_session, "planned-update-all@example.com")
    _auth_as(user)
    start = date.today()
    end = start + (date.resolution * 3)
    try:
        create = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Recurring cleanup",
                "planned_for": start.isoformat(),
                "rrule": "FREQ=DAILY;COUNT=4",
            },
        )
        assert create.status_code == 200
        planned_id = create.json()["id"]
        listed = client.get(
            f"/api/v1/planned-items?start_date={start.isoformat()}&end_date={end.isoformat()}"
        )
        assert listed.status_code == 200

        update = client.put(
            f"/api/v1/planned-items/{planned_id}?scope=all",
            json={
                "title": "Recurring cleanup all updated",
                "planned_for": start.isoformat(),
                "is_done": False,
                "rrule": "FREQ=DAILY;COUNT=4",
            },
        )
    finally:
        _clear_auth()

    assert update.status_code == 200
    assert update.json()["title"] == "Recurring cleanup all updated"

    series = db_session.query(RecurrenceSeries).filter(RecurrenceSeries.user_id == user.id).one()
    assert series.title == "Recurring cleanup all updated"
    assert series.materialized_through == start - date.resolution

    remaining = (
        db_session.query(PlannedItem)
        .filter(PlannedItem.user_id == user.id, PlannedItem.recurrence_series_id == series.id)
        .all()
    )
    assert [item.id for item in remaining] == [planned_id]


def test_update_planned_item_scope_all_from_later_instance_preserves_series_start(
    client: TestClient,
    db_session: Session,
) -> None:
    user = _create_user(db_session, "planned-update-all-later@example.com")
    _auth_as(user)
    start = date.today()
    edit_date = start + date.resolution
    end = start + (date.resolution * 3)
    try:
        create = client.post(
            "/api/v1/planned-items",
            json={
                "title": "Recurring cleanup",
                "planned_for": start.isoformat(),
                "rrule": "FREQ=DAILY;COUNT=4",
            },
        )
        assert create.status_code == 200
        listed = client.get(
            f"/api/v1/planned-items?start_date={start.isoformat()}&end_date={end.isoformat()}"
        )
        assert listed.status_code == 200
        planned_id = next(item["id"] for item in listed.json() if item["planned_for"] == edit_date.isoformat())

        update = client.put(
            f"/api/v1/planned-items/{planned_id}?scope=all",
            json={
                "title": "Recurring cleanup all updated",
                "planned_for": edit_date.isoformat(),
                "is_done": False,
                "rrule": "FREQ=DAILY;COUNT=4",
            },
        )
        refreshed = client.get(
            f"/api/v1/planned-items?start_date={start.isoformat()}&end_date={end.isoformat()}"
        )
    finally:
        _clear_auth()

    assert update.status_code == 200

    series = db_session.query(RecurrenceSeries).filter(RecurrenceSeries.user_id == user.id).one()
    assert series.start_date == start
    assert series.title == "Recurring cleanup all updated"
    assert series.materialized_through == date(9999, 12, 31)

    assert refreshed.status_code == 200
    assert [item["planned_for"] for item in refreshed.json()] == [
        start.isoformat(),
        edit_date.isoformat(),
        (start + (date.resolution * 2)).isoformat(),
        end.isoformat(),
    ]
    assert {item["title"] for item in refreshed.json()} == {"Recurring cleanup all updated"}
