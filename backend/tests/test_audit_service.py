from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.models.audit_entry import AuditEntry
from app.services.audit_service import list_audit_entries


def _entry(*, user_id: int, timestamp: datetime, resource_id: str) -> AuditEntry:
    return AuditEntry(
        timestamp=timestamp,
        actor_user_id=user_id,
        auth_source="keycloak_user",
        action="test.update",
        resource_type="test",
        resource_id=resource_id,
        details={},
    )


def test_audit_keyset_pagination_follows_timestamp_and_id(db_session: Session) -> None:
    now = datetime.now(UTC)
    entries = [
        _entry(user_id=1, timestamp=now, resource_id="newest"),
        _entry(user_id=1, timestamp=now - timedelta(minutes=1), resource_id="middle"),
        _entry(user_id=1, timestamp=now - timedelta(minutes=2), resource_id="oldest"),
    ]
    db_session.add_all(entries)
    db_session.commit()

    first_page = list_audit_entries(db_session, actor_user_id=1, limit=2)
    second_page = list_audit_entries(
        db_session,
        actor_user_id=1,
        limit=2,
        before_id=first_page[-1].id,
    )

    assert [entry.resource_id for entry in first_page] == ["newest", "middle"]
    assert [entry.resource_id for entry in second_page] == ["oldest"]


def test_audit_pagination_rejects_invalid_limit_and_cross_user_cursor(
    db_session: Session,
) -> None:
    cursor = _entry(user_id=2, timestamp=datetime.now(UTC), resource_id="private")
    db_session.add(cursor)
    db_session.commit()

    with pytest.raises(ValueError, match="limit must be between"):
        list_audit_entries(db_session, actor_user_id=1, limit=0)
    with pytest.raises(ValueError, match="does not exist for this user"):
        list_audit_entries(db_session, actor_user_id=1, before_id=cursor.id)
