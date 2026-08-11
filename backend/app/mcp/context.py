"""Session scoping and service construction shared by every MCP domain module.

Every domain module function opens exactly one session, resolves the
principal within it (so ``resolve_principal``'s own queries share the
mutation's transaction), builds the service(s) it needs, and hands both to
the caller-supplied operation — mirroring the ``_with_service`` /
``_with_meal_plan_service`` / ``_with_shopping_service`` helpers that used to
live on ``DaynestMcpBackend`` directly.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime, time
from typing import Any

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.pagination import DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, clamp_limit
from app.mcp.principal import McpPrincipal, resolve_principal
from app.repositories.meal_plan_repository import MealPlanRepository
from app.repositories.shopping_list_repository import ShoppingListRepository
from app.repositories.today_repository import TodayRepository
from app.services.meal_plan_service import MealPlanService
from app.services.shopping_list_service import ShoppingListService
from app.services.today_service import TodayService

__all__ = [
    "DEFAULT_LIST_LIMIT",
    "MAX_LIST_LIMIT",
    "clamp_limit",
    "jsonable",
    "parse_date",
    "parse_time",
    "session_scope",
    "with_meal_plan_service",
    "with_principal",
    "with_shopping_service",
    "with_today_service",
]


@contextmanager
def session_scope(session_factory: Callable[[], Session]) -> Iterator[Session]:
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def with_principal[T](
    session_factory: Callable[[], Session],
    user_email: str | None,
    operation: Callable[[Session, McpPrincipal], T],
) -> T:
    with session_scope(session_factory) as db:
        principal = resolve_principal(db, user_email=user_email)
        return operation(db, principal)


def with_today_service[T](
    session_factory: Callable[[], Session],
    user_email: str | None,
    operation: Callable[[Session, McpPrincipal, TodayService], T],
) -> T:
    def _op(db: Session, principal: McpPrincipal) -> T:
        service = TodayService(TodayRepository(db), app_settings=settings)
        return operation(db, principal, service)

    return with_principal(session_factory, user_email, _op)


def with_meal_plan_service[T](
    session_factory: Callable[[], Session],
    user_email: str | None,
    operation: Callable[[Session, McpPrincipal, MealPlanService], T],
) -> T:
    def _op(db: Session, principal: McpPrincipal) -> T:
        service = MealPlanService(MealPlanRepository(db))
        return operation(db, principal, service)

    return with_principal(session_factory, user_email, _op)


def with_shopping_service[T](
    session_factory: Callable[[], Session],
    user_email: str | None,
    operation: Callable[[Session, McpPrincipal, ShoppingListService], T],
) -> T:
    def _op(db: Session, principal: McpPrincipal) -> T:
        today_service = TodayService(TodayRepository(db), app_settings=settings)
        service = ShoppingListService(ShoppingListRepository(db), today_service)
        return operation(db, principal, service)

    return with_principal(session_factory, user_email, _op)


def parse_date(value: str | None) -> date:
    if not value or value == "today":
        return datetime.now(UTC).date()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(
            f"Invalid date '{value}'. Expected YYYY-MM-DD format or 'today'."
        )


def parse_time(value: str | None) -> time | None:
    if not value:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=UTC).time()
        except ValueError:
            continue
    raise ValueError(f"Invalid time '{value}'. Expected HH:MM or HH:MM:SS format.")


def jsonable(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, list):
        return [jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: jsonable(item) for key, item in value.items()}
    return value
