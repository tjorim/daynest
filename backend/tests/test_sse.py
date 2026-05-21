import asyncio
from collections.abc import Coroutine
from datetime import datetime, timezone
from typing import Any

import pytest
from sqlalchemy.orm import Session

from app.api.dependencies.events import get_event_bus
from app.api.routes.today import stream_today_updates
from app.main import _publish_today_rollovers
from app.models.user import User
from app.services.event_bus import EventBus


class _FakeRequest:
    def __init__(self) -> None:
        self._calls = 0

    async def is_disconnected(self) -> bool:
        self._calls += 1
        return self._calls > 1


@pytest.mark.anyio
async def test_today_stream_emits_today_updated_event() -> None:
    user = User(id=1001, email="sse-updated@example.com", is_active=True, timezone="UTC")
    request = _FakeRequest()
    event_bus = get_event_bus()
    response = await stream_today_updates(request=request, event_bus=event_bus, current_user=user)
    event_bus.publish(user.id, {"type": "today_updated"})
    chunk = await anext(response.body_iterator)
    assert chunk["event"] == "today_updated"
    await response.body_iterator.aclose()


@pytest.mark.anyio
async def test_today_stream_emits_ping(monkeypatch) -> None:
    user = User(id=1002, email="sse-ping@example.com", is_active=True, timezone="UTC")
    request = _FakeRequest()
    event_bus = get_event_bus()

    def _simulate_timeout(coroutine: Coroutine[Any, Any, Any], timeout: float | None = None) -> None:
        _ = timeout
        coroutine.close()
        raise TimeoutError

    monkeypatch.setattr(asyncio, "wait_for", _simulate_timeout)
    response = await stream_today_updates(request=request, event_bus=event_bus, current_user=user)
    chunk = await anext(response.body_iterator)
    assert chunk["event"] == "ping"
    await response.body_iterator.aclose()


@pytest.mark.anyio
async def test_today_rollover_publishes_today_updated_for_subscribed_user(db_session: Session) -> None:
    user = User(email="sse-rollover@example.com", is_active=True, timezone="Europe/Brussels")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    event_bus = EventBus()
    queue = event_bus.subscribe(user.id)
    local_dates = {}

    _publish_today_rollovers(
        db_session,
        event_bus,
        local_dates,
        now=datetime(2026, 5, 21, 21, 59, tzinfo=timezone.utc),
    )
    assert queue.empty()

    _publish_today_rollovers(
        db_session,
        event_bus,
        local_dates,
        now=datetime(2026, 5, 21, 22, 1, tzinfo=timezone.utc),
    )
    event = await asyncio.wait_for(queue.get(), timeout=1)
    assert event == {"type": "today_updated"}
