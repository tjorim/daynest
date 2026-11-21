"""Headers that keep private responses private.

The API sets headers per route (there is no blanket middleware, like in the other apps); the transport-level ones
(``Strict-Transport-Security``, ``X-Content-Type-Options``, CSP) belong to the reverse proxy in front of it. What this
app owns, and what is asserted here: files that carry personal data are downloads that are never cached, the
calendar feed token is not echoed in the access log (see ``test_observability``), and every response, errors
included, carries the request id.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User
from app.routers.dependencies.auth import get_current_user, get_current_user_optional


@pytest.fixture
def signed_in(db_session: Session) -> Generator[User]:
    user = User(
        email="headers@example.com",
        full_name="Headers",
        is_active=True,
        timezone="UTC",
        calendar_feed_token="feed-token-for-headers",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    async def current() -> User:
        return user

    app.dependency_overrides[get_current_user] = current
    app.dependency_overrides[get_current_user_optional] = current
    yield user
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_optional, None)


@pytest.mark.usefixtures("signed_in")
@pytest.mark.parametrize("path", ["/api/calendar/export.ics", "/api/calendar/feed/feed-token-for-headers.ics"])
def test_calendar_files_are_private_downloads_that_are_never_cached(client: TestClient, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/calendar")
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["pragma"] == "no-cache"
    assert response.headers["expires"] == "0"
    assert response.headers["content-disposition"].startswith("attachment;")


@pytest.mark.usefixtures("signed_in")
def test_the_csv_export_is_an_attachment(client: TestClient) -> None:
    response = client.get("/api/users/me/export?format=csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"].startswith("attachment;")


def test_an_unknown_calendar_feed_is_a_json_404_not_a_cacheable_file(client: TestClient) -> None:
    response = client.get("/api/calendar/feed/unknown-token.ics")

    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"
    assert response.json()["code"] == "calendar_feed_not_found"
    assert "unknown-token" not in response.text


@pytest.mark.parametrize("path", ["/api/today", "/api/does-not-exist", "/api/health"])
def test_every_response_carries_a_request_id_including_errors(client: TestClient, path: str) -> None:
    response = client.get(path)

    assert response.headers["x-request-id"]
