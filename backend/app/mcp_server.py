from __future__ import annotations

import json
import logging
import os
import sys
from collections.abc import Callable
from contextlib import contextmanager
from datetime import date, datetime
from typing import Any, Literal, TypeVar, cast

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.server import Context, TransportSecuritySettings
from pydantic import AnyHttpUrl, BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.integration_auth import (
    enforce_integration_rate_limit,
    ensure_integration_scope,
    get_integration_client_by_token_hash,
    hash_integration_key,
)
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.integration_client import IntegrationClient
from app.models.user import User
from app.repositories.today_repository import TodayRepository
from app.schemas.today import PlannedItemCreateRequest, PlannedItemModuleKey, PlannedItemUpdateRequest
from app.services.today_service import TodayService

logger = logging.getLogger(__name__)

if not logger.handlers:
    logging.basicConfig(stream=sys.stderr, level=logging.INFO)

DAYNEST_USER_EMAIL_ENV = "DAYNEST_USER_EMAIL"
DAYNEST_MCP_RESOURCE_SERVER_URL_ENV = "DAYNEST_MCP_RESOURCE_SERVER_URL"
DAYNEST_MCP_ISSUER_URL_ENV = "DAYNEST_MCP_ISSUER_URL"
DAYNEST_MCP_ALLOWED_ORIGINS_ENV = "DAYNEST_MCP_ALLOWED_ORIGINS"
DAYNEST_MCP_ALLOWED_HOSTS_ENV = "DAYNEST_MCP_ALLOWED_HOSTS"

T = TypeVar("T")


def _parse_date(value: str | None) -> date:
    if not value or value == "today":
        return date.today()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"Invalid date '{value}'. Expected YYYY-MM-DD format or 'today'.")


def _jsonable(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    return value


def _parse_csv_env(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


class DaynestMcpBackend:
    def __init__(
        self,
        session_factory: Callable[[], Session],
        *,
        user_email: str | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.user_email = user_email

    @contextmanager
    def _session_scope(self) -> Any:
        session = self.session_factory()
        try:
            yield session
        finally:
            session.close()

    def resolve_user(self, db: Session) -> User:
        integration_client = self._resolve_authenticated_integration_client(db)
        if integration_client is not None:
            if integration_client.user is None or not integration_client.user.is_active:
                raise ValueError("Authenticated integration owner not found or inactive")
            return integration_client.user

        configured_email = self.user_email or os.getenv(DAYNEST_USER_EMAIL_ENV)
        if configured_email:
            user = db.scalar(select(User).where(User.email == configured_email.lower()).where(User.is_active.is_(True)))
            if user is None:
                raise ValueError(f"Active user not found for {DAYNEST_USER_EMAIL_ENV}={configured_email}")
            return user

        active_users = list(db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.id.asc())).all())
        if not active_users:
            raise ValueError(
                "No active Daynest user found. Create an account first or set "
                f"{DAYNEST_USER_EMAIL_ENV}=you@example.com."
            )
        if len(active_users) > 1:
            available_emails = ", ".join(user.email for user in active_users)
            raise ValueError(
                f"Multiple active Daynest users found. Set {DAYNEST_USER_EMAIL_ENV} to one of: {available_emails}"
            )
        return active_users[0]

    @staticmethod
    def _resolve_authenticated_integration_client(db: Session) -> IntegrationClient | None:
        access_token = get_access_token()
        if access_token is None:
            return None

        try:
            client_id = int(access_token.client_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Authenticated MCP client id is invalid") from exc

        stmt = select(IntegrationClient).where(IntegrationClient.id == client_id).options(joinedload(IntegrationClient.user))
        client = db.scalar(stmt)
        if client is None or not client.is_active:
            raise ValueError("Authenticated MCP integration client is inactive or missing")
        return client

    def _with_service(self, operation: Callable[[Session, User, TodayService], T]) -> T:
        with self._session_scope() as db:
            user = self.resolve_user(db)
            service = TodayService(TodayRepository(db))
            return operation(db, user, service)

    def whoami(self) -> dict[str, Any]:
        return self._with_service(
            lambda _db, user, _service: {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
            }
        )

    def list_users(self) -> list[dict[str, Any]]:
        with self._session_scope() as db:
            users = list(db.scalars(select(User).order_by(User.id.asc())).all())
            return [
                {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "is_active": user.is_active,
                }
                for user in users
            ]

    def get_today(self, for_date: str | None = None) -> dict[str, Any]:
        target_date = _parse_date(for_date)
        return self._with_service(lambda _db, user, service: _jsonable(service.get_today(user.id, target_date)))

    def get_calendar_day(self, for_date: str | None = None) -> dict[str, Any]:
        target_date = _parse_date(for_date)
        return self._with_service(lambda _db, user, service: _jsonable(service.get_day_items(user.id, target_date)))

    def get_calendar_month(self, year: int, month: int) -> dict[str, Any]:
        return self._with_service(lambda _db, user, service: _jsonable(service.get_month(user.id, year, month)))

    def list_planned_items(self, start_date: str | None = None, end_date: str | None = None) -> list[dict[str, Any]]:
        parsed_start = _parse_date(start_date) if start_date else None
        parsed_end = _parse_date(end_date) if end_date else None
        return self._with_service(
            lambda _db, user, service: _jsonable(service.list_planned_items(user.id, start_date=parsed_start, end_date=parsed_end))
        )

    def create_planned_item(
        self,
        title: str,
        planned_for: str,
        notes: str | None = None,
        module_key: PlannedItemModuleKey | None = None,
        recurrence_hint: str | None = None,
        linked_source: str | None = None,
        linked_ref: str | None = None,
    ) -> dict[str, Any]:
        request = PlannedItemCreateRequest(
            title=title,
            planned_for=_parse_date(planned_for),
            notes=notes,
            module_key=module_key,
            recurrence_hint=recurrence_hint,
            linked_source=linked_source,
            linked_ref=linked_ref,
        )
        return self._with_service(lambda _db, user, service: _jsonable(service.create_planned_item(user.id, request)))

    def update_planned_item(
        self,
        planned_item_id: int,
        title: str,
        planned_for: str,
        is_done: bool = False,
        notes: str | None = None,
        module_key: PlannedItemModuleKey | None = None,
        recurrence_hint: str | None = None,
        linked_source: str | None = None,
        linked_ref: str | None = None,
    ) -> dict[str, Any]:
        request = PlannedItemUpdateRequest(
            title=title,
            planned_for=_parse_date(planned_for),
            is_done=is_done,
            notes=notes,
            module_key=module_key,
            recurrence_hint=recurrence_hint,
            linked_source=linked_source,
            linked_ref=linked_ref,
        )
        return self._with_service(lambda _db, user, service: _jsonable(service.update_planned_item(user.id, planned_item_id, request)))

    def delete_planned_item(self, planned_item_id: int) -> dict[str, Any]:
        self._with_service(lambda _db, user, service: service.delete_planned_item(user.id, planned_item_id))
        return {"deleted": True, "planned_item_id": planned_item_id}

    def complete_chore(self, chore_instance_id: int) -> dict[str, Any]:
        return self._with_service(lambda _db, user, service: _jsonable(service.complete_chore(user.id, chore_instance_id)))

    def skip_chore(self, chore_instance_id: int) -> dict[str, Any]:
        return self._with_service(lambda _db, user, service: _jsonable(service.skip_chore(user.id, chore_instance_id)))

    def reschedule_chore(self, chore_instance_id: int, scheduled_date: str) -> dict[str, Any]:
        return self._with_service(
            lambda _db, user, service: _jsonable(service.reschedule_chore(user.id, chore_instance_id, _parse_date(scheduled_date)))
        )

    def start_routine_task(self, task_instance_id: int) -> dict[str, Any]:
        return self._with_service(lambda _db, user, service: _jsonable(service.start_routine_task(user.id, task_instance_id)))

    def complete_routine_task(self, task_instance_id: int) -> dict[str, Any]:
        return self._with_service(lambda _db, user, service: _jsonable(service.complete_routine_task(user.id, task_instance_id)))

    def skip_routine_task(self, task_instance_id: int) -> dict[str, Any]:
        return self._with_service(lambda _db, user, service: _jsonable(service.skip_routine_task(user.id, task_instance_id)))

    def take_medication_dose(self, medication_dose_instance_id: int) -> dict[str, Any]:
        return self._mutate_medication(medication_dose_instance_id, "take")

    def skip_medication_dose(self, medication_dose_instance_id: int) -> dict[str, Any]:
        return self._mutate_medication(medication_dose_instance_id, "skip")

    def _mutate_medication(self, medication_dose_instance_id: int, action: str) -> dict[str, Any]:
        def _operation(_db: Session, user: User, service: TodayService) -> dict[str, Any]:
            instance = service.mutate_medication_status(user.id, medication_dose_instance_id, action)
            return {
                "medication_dose_instance_id": instance.id,
                "medication_plan_id": instance.medication_plan_id,
                "name": instance.name,
                "status": instance.status.value,
                "scheduled_date": instance.scheduled_date.isoformat(),
                "scheduled_at": instance.scheduled_at.isoformat(),
                "taken_at": instance.taken_at.isoformat() if instance.taken_at else None,
                "skipped_at": instance.skipped_at.isoformat() if instance.skipped_at else None,
                "missed_at": instance.missed_at.isoformat() if instance.missed_at else None,
            }

        return self._with_service(_operation)


class IntegrationKeyTokenVerifier(TokenVerifier):
    REQUIRED_SCOPE = "mcp:read"

    def __init__(self, session_factory: Callable[[], Session], *, resource_server_url: str | None = None) -> None:
        self.session_factory = session_factory
        self.resource_server_url = resource_server_url

    async def verify_token(self, token: str) -> AccessToken | None:
        session = self.session_factory()
        try:
            token_hash = hash_integration_key(token)
            client = get_integration_client_by_token_hash(session, token_hash)
            if client is None or not client.is_active or client.user is None or not client.user.is_active:
                return None

            try:
                ensure_integration_scope(client, self.REQUIRED_SCOPE)
                enforce_integration_rate_limit(client)
            except Exception:
                return None

            scopes = [scope for scope in client.scopes_csv.split(",") if scope]
            return AccessToken(
                token=token,
                client_id=str(client.id),
                scopes=scopes,
                resource=self.resource_server_url,
            )
        finally:
            session.close()


def _build_auth_settings(resource_server_url: str) -> AuthSettings:
    issuer_url = os.getenv(DAYNEST_MCP_ISSUER_URL_ENV, resource_server_url)
    return AuthSettings(
        issuer_url=AnyHttpUrl(issuer_url),
        resource_server_url=AnyHttpUrl(resource_server_url),
        required_scopes=["mcp:read"],
    )


def _build_transport_security() -> TransportSecuritySettings:
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=_parse_csv_env(DAYNEST_MCP_ALLOWED_HOSTS_ENV, settings.trusted_hosts),
        allowed_origins=_parse_csv_env(DAYNEST_MCP_ALLOWED_ORIGINS_ENV, settings.cors_allow_origins),
    )


def create_mcp_server(backend: DaynestMcpBackend | None = None) -> FastMCP:
    daynest = backend or DaynestMcpBackend(SessionLocal)
    resource_server_url = os.getenv(DAYNEST_MCP_RESOURCE_SERVER_URL_ENV, "http://127.0.0.1:8000/mcp")

    mcp = FastMCP(
        "Daynest",
        json_response=True,
        streamable_http_path="/mcp",
        token_verifier=IntegrationKeyTokenVerifier(SessionLocal, resource_server_url=resource_server_url),
        auth=_build_auth_settings(resource_server_url),
        transport_security=_build_transport_security(),
    )

    @mcp.tool()
    async def whoami(ctx: Context) -> dict[str, Any]:
        """Return the active Daynest user used by this MCP server."""

        await ctx.debug("Resolving authenticated Daynest user")
        return daynest.whoami()

    @mcp.tool()
    async def list_users() -> list[dict[str, Any]]:
        """List local Daynest users to help choose DAYNEST_USER_EMAIL when multiple accounts exist."""

        return daynest.list_users()

    @mcp.tool()
    async def get_today(for_date: str = "today") -> dict[str, Any]:
        """Return the Daynest Today payload for a given date in YYYY-MM-DD format or 'today'."""

        return daynest.get_today(for_date)

    @mcp.tool()
    async def get_calendar_day(for_date: str = "today") -> dict[str, Any]:
        """Return the Daynest calendar day view for a date in YYYY-MM-DD format or 'today'."""

        return daynest.get_calendar_day(for_date)

    @mcp.tool()
    async def get_calendar_month(year: int, month: int) -> dict[str, Any]:
        """Return the Daynest calendar month summary for a year and month."""

        return daynest.get_calendar_month(year, month)

    @mcp.tool()
    async def list_planned_items(start_date: str | None = None, end_date: str | None = None) -> list[dict[str, Any]]:
        """List planned items, optionally filtered by inclusive start and end dates in YYYY-MM-DD format."""

        return daynest.list_planned_items(start_date, end_date)

    @mcp.tool()
    async def create_planned_item(
        title: str,
        planned_for: str,
        notes: str | None = None,
        module_key: PlannedItemModuleKey | None = None,
        recurrence_hint: str | None = None,
        linked_source: str | None = None,
        linked_ref: str | None = None,
    ) -> dict[str, Any]:
        """Create a planned Daynest item."""

        return daynest.create_planned_item(
            title=title,
            planned_for=planned_for,
            notes=notes,
            module_key=module_key,
            recurrence_hint=recurrence_hint,
            linked_source=linked_source,
            linked_ref=linked_ref,
        )

    @mcp.tool()
    async def update_planned_item(
        planned_item_id: int,
        title: str,
        planned_for: str,
        is_done: bool = False,
        notes: str | None = None,
        module_key: PlannedItemModuleKey | None = None,
        recurrence_hint: str | None = None,
        linked_source: str | None = None,
        linked_ref: str | None = None,
    ) -> dict[str, Any]:
        """Update a planned Daynest item."""

        return daynest.update_planned_item(
            planned_item_id=planned_item_id,
            title=title,
            planned_for=planned_for,
            is_done=is_done,
            notes=notes,
            module_key=module_key,
            recurrence_hint=recurrence_hint,
            linked_source=linked_source,
            linked_ref=linked_ref,
        )

    @mcp.tool()
    async def delete_planned_item(planned_item_id: int) -> dict[str, Any]:
        """Delete a planned Daynest item by id."""

        return daynest.delete_planned_item(planned_item_id)

    @mcp.tool()
    async def complete_chore(chore_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest chore instance as completed."""

        return daynest.complete_chore(chore_instance_id)

    @mcp.tool()
    async def skip_chore(chore_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest chore instance as skipped."""

        return daynest.skip_chore(chore_instance_id)

    @mcp.tool()
    async def reschedule_chore(chore_instance_id: int, scheduled_date: str) -> dict[str, Any]:
        """Reschedule a Daynest chore instance to a new YYYY-MM-DD date."""

        return daynest.reschedule_chore(chore_instance_id, scheduled_date)

    @mcp.tool()
    async def start_routine_task(task_instance_id: int) -> dict[str, Any]:
        """Start a Daynest routine task."""

        return daynest.start_routine_task(task_instance_id)

    @mcp.tool()
    async def complete_routine_task(task_instance_id: int) -> dict[str, Any]:
        """Complete a Daynest routine task."""

        return daynest.complete_routine_task(task_instance_id)

    @mcp.tool()
    async def skip_routine_task(task_instance_id: int) -> dict[str, Any]:
        """Skip a Daynest routine task."""

        return daynest.skip_routine_task(task_instance_id)

    @mcp.tool()
    async def take_medication_dose(medication_dose_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest medication dose as taken."""

        return daynest.take_medication_dose(medication_dose_instance_id)

    @mcp.tool()
    async def skip_medication_dose(medication_dose_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest medication dose as skipped."""

        return daynest.skip_medication_dose(medication_dose_instance_id)

    @mcp.resource("daynest://today/{for_date}")
    async def today_resource(for_date: str) -> str:
        """Read the Daynest Today payload as a JSON resource."""

        return json.dumps(daynest.get_today(for_date), indent=2)

    @mcp.resource("daynest://calendar/day/{for_date}")
    async def calendar_day_resource(for_date: str) -> str:
        """Read the Daynest day view as a JSON resource."""

        return json.dumps(daynest.get_calendar_day(for_date), indent=2)

    @mcp.prompt()
    def daily_briefing(for_date: str = "today") -> str:
        """Generate a prompt for reviewing a Daynest day plan."""

        return (
            "Review the Daynest schedule for "
            f"{for_date}. Summarize the priorities, flag overdue chores, "
            "note due medications, and propose a concise execution order."
        )

    return mcp


mcp = create_mcp_server()


def main() -> None:
    transport_name = os.getenv("DAYNEST_MCP_TRANSPORT", "stdio")
    if transport_name not in {"stdio", "sse", "streamable-http"}:
        raise ValueError(f"Unsupported DAYNEST_MCP_TRANSPORT: {transport_name}")
    transport = cast(Literal["stdio", "sse", "streamable-http"], transport_name)
    logger.info("Starting Daynest MCP server with transport=%s", transport)
    mcp.run(transport=transport)


if __name__ == "__main__":
    main()
