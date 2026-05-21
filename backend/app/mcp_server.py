from __future__ import annotations

import json
import logging
import os
import sys
from collections.abc import Callable
from contextlib import contextmanager
from datetime import date, datetime, time
from secrets import token_urlsafe
from typing import Any, Literal, TypeVar

from anyio import to_thread
from fastapi import HTTPException
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import AnyHttpUrl, BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.integration_auth import (
    enforce_integration_rate_limit,
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




def _routine_template_to_dict(t: Any) -> dict[str, Any]:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "start_date": t.start_date.isoformat(),
        "every_n_days": t.every_n_days,
        "rrule": t.rrule,
        "due_time": t.due_time.isoformat() if t.due_time else None,
        "is_active": t.is_active,
    }


def _chore_template_to_dict(t: Any) -> dict[str, Any]:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "start_date": t.start_date.isoformat(),
        "every_n_days": t.every_n_days,
        "rrule": t.rrule,
        "priority": t.priority,
        "tags": t.tags or [],
        "is_active": t.is_active,
    }


def _medication_plan_to_dict(plan: Any) -> dict[str, Any]:
    return {
        "id": plan.id,
        "name": plan.name,
        "instructions": plan.instructions,
        "start_date": plan.start_date.isoformat(),
        "schedule_time": plan.schedule_time.isoformat(),
        "every_n_days": plan.every_n_days,
        "is_active": plan.is_active,
    }


def _integration_client_to_dict(client: IntegrationClient) -> dict[str, Any]:
    return {
        "id": client.id,
        "name": client.name,
        "rate_limit_per_minute": client.rate_limit_per_minute,
        "is_active": client.is_active,
    }


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
        access_token = get_access_token()
        if access_token is not None:
            auth_source = getattr(access_token, "auth_source", None)

            if auth_source == "integration":
                integration_client_id = getattr(access_token, "integration_client_id", None)
                if integration_client_id is None:
                    raise ValueError("Authenticated MCP integration token is missing a client ID")
                # verify_token stores only an AccessToken in request context — re-query with joinedload.
                stmt = select(IntegrationClient).where(IntegrationClient.id == integration_client_id).options(joinedload(IntegrationClient.user))
                client = db.scalar(stmt)
                if client is None or not client.is_active:
                    raise ValueError("Authenticated MCP integration client is inactive or missing")
                if client.user is None or not client.user.is_active:
                    raise ValueError("Authenticated integration owner not found or inactive")
                return client.user

            if auth_source == "oidc":
                oidc_subject = getattr(access_token, "oidc_subject", None)
                if not oidc_subject:
                    raise ValueError("Authenticated MCP OIDC token is missing a subject")
                user = db.scalar(select(User).where(User.oidc_subject == oidc_subject).where(User.is_active.is_(True)))
                if user is None:
                    raise ValueError(f"No active user found for OIDC subject: {oidc_subject}")
                return user

            client_id = access_token.client_id
            if not client_id:
                raise ValueError("Authenticated MCP access token is missing a client ID")
            raise ValueError(f"Unsupported MCP access token source for client ID: {client_id}")

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
            logger.debug(
                "Multiple active users: %s",
                ", ".join(user.email for user in active_users),
            )
            raise ValueError(
                f"Multiple active Daynest users found ({len(active_users)} matches). "
                f"Set {DAYNEST_USER_EMAIL_ENV} to the correct account or inspect active users locally."
            )
        return active_users[0]

    def _with_service(self, operation: Callable[[Session, User, TodayService], T]) -> T:
        with self._session_scope() as db:
            user = self.resolve_user(db)
            service = TodayService(TodayRepository(db), app_settings=settings)
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

    def list_integration_clients(self) -> list[dict[str, Any]]:
        with self._session_scope() as db:
            user = self.resolve_user(db)
            clients = list(
                db.scalars(
                    select(IntegrationClient)
                    .where(IntegrationClient.user_id == user.id)
                    .order_by(IntegrationClient.id.asc())
                ).all()
            )
            return [_integration_client_to_dict(client) for client in clients]

    def create_integration_client(
        self,
        name: str,
        rate_limit_per_minute: int = 120,
    ) -> dict[str, Any]:
        access_token = get_access_token()
        if getattr(access_token, "auth_source", None) == "integration":
            raise PermissionError("Integration tokens cannot create new integration clients")

        if not isinstance(rate_limit_per_minute, int) or rate_limit_per_minute <= 0:
            raise ValueError("rate_limit_per_minute must be a positive integer")
        if rate_limit_per_minute > 600:
            raise ValueError("rate_limit_per_minute must be 600 or less")

        raw_key = f"daynest_{token_urlsafe(30)}"
        with self._session_scope() as db:
            user = self.resolve_user(db)
            client = IntegrationClient(
                user_id=user.id,
                name=name,
                key_hash=hash_integration_key(raw_key),
                rate_limit_per_minute=rate_limit_per_minute,
                is_active=True,
            )
            db.add(client)
            db.commit()
            db.refresh(client)
            return {**_integration_client_to_dict(client), "api_key": raw_key}

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

    def list_routines(self) -> list[dict[str, Any]]:
        return self._with_service(
            lambda _db, user, service: [_routine_template_to_dict(t) for t in service.list_routine_templates(user.id)]
        )

    def create_routine(
        self,
        name: str,
        start_date: str,
        every_n_days: int = 1,
        description: str | None = None,
        due_time: str | None = None,
        is_active: bool = True,
    ) -> dict[str, Any]:
        parsed_start = _parse_date(start_date)
        parsed_due_time = time.fromisoformat(due_time) if due_time and due_time.strip() else None
        return self._with_service(
            lambda _db, user, service: _routine_template_to_dict(
                service.create_routine_template(
                    user.id,
                    name=name,
                    start_date=parsed_start,
                    every_n_days=every_n_days,
                    description=description,
                    due_time=parsed_due_time,
                    is_active=is_active,
                )
            )
        )

    def update_routine(
        self,
        routine_template_id: int,
        name: str,
        start_date: str,
        every_n_days: int | None = None,
        description: str | None = None,
        due_time: str | None = None,
        is_active: bool | None = None,
    ) -> dict[str, Any]:
        parsed_start = _parse_date(start_date)
        parsed_due_time = time.fromisoformat(due_time) if due_time and due_time.strip() else None
        return self._with_service(
            lambda _db, user, service: _routine_template_to_dict(
                service.update_routine_template(
                    user.id,
                    routine_template_id,
                    name=name,
                    start_date=parsed_start,
                    every_n_days=every_n_days,
                    rrule=None,
                    description=description,
                    due_time=parsed_due_time,
                    is_active=is_active,
                )
            )
        )

    def delete_routine(self, routine_template_id: int) -> dict[str, Any]:
        self._with_service(lambda _db, user, service: service.delete_routine_template(user.id, routine_template_id))
        return {"deleted": True, "routine_template_id": routine_template_id}

    def list_chore_templates(self) -> list[dict[str, Any]]:
        return self._with_service(
            lambda _db, user, service: [_chore_template_to_dict(t) for t in service.list_chore_templates(user.id)]
        )

    def create_chore_template(
        self,
        name: str,
        start_date: str,
        every_n_days: int = 1,
        description: str | None = None,
        is_active: bool = True,
    ) -> dict[str, Any]:
        parsed_start = _parse_date(start_date)
        return self._with_service(
            lambda _db, user, service: _chore_template_to_dict(
                service.create_chore_template(
                    user.id,
                    name=name,
                    start_date=parsed_start,
                    every_n_days=every_n_days,
                    description=description,
                    is_active=is_active,
                )
            )
        )

    def update_chore_template(
        self,
        chore_template_id: int,
        name: str,
        start_date: str,
        every_n_days: int | None = None,
        description: str | None = None,
        is_active: bool | None = None,
    ) -> dict[str, Any]:
        parsed_start = _parse_date(start_date)
        return self._with_service(
            lambda _db, user, service: _chore_template_to_dict(
                service.update_chore_template(
                    user.id,
                    chore_template_id,
                    name=name,
                    start_date=parsed_start,
                    every_n_days=every_n_days,
                    rrule=None,
                    priority="normal",
                    tags=[],
                    description=description,
                    is_active=is_active,
                )
            )
        )

    def delete_chore_template(self, chore_template_id: int) -> dict[str, Any]:
        self._with_service(lambda _db, user, service: service.delete_chore_template(user.id, chore_template_id))
        return {"deleted": True, "chore_template_id": chore_template_id}

    def take_medication_dose(self, medication_dose_instance_id: int) -> dict[str, Any]:
        return self._mutate_medication(medication_dose_instance_id, "take")

    def skip_medication_dose(self, medication_dose_instance_id: int) -> dict[str, Any]:
        return self._mutate_medication(medication_dose_instance_id, "skip")

    def list_medications(self) -> list[dict[str, Any]]:
        return self._with_service(
            lambda _db, user, service: [_medication_plan_to_dict(p) for p in service.list_medication_plans(user.id)]
        )

    def create_medication(
        self,
        name: str,
        instructions: str,
        start_date: str,
        schedule_time: str,
        every_n_days: int = 1,
    ) -> dict[str, Any]:
        parsed_start = date.fromisoformat(start_date)
        parsed_time = time.fromisoformat(schedule_time)
        return self._with_service(
            lambda _db, user, service: _medication_plan_to_dict(
                service.create_medication_plan(
                    user.id,
                    name=name,
                    instructions=instructions,
                    start_date=parsed_start,
                    schedule_time=parsed_time,
                    every_n_days=every_n_days,
                )
            )
        )

    def update_medication(
        self,
        medication_plan_id: int,
        name: str,
        instructions: str,
        start_date: str,
        schedule_time: str,
        every_n_days: int | None = None,
        is_active: bool | None = None,
    ) -> dict[str, Any]:
        parsed_start = date.fromisoformat(start_date)
        parsed_time = time.fromisoformat(schedule_time)
        return self._with_service(
            lambda _db, user, service: _medication_plan_to_dict(
                service.update_medication_plan(
                    user.id,
                    medication_plan_id,
                    name=name,
                    instructions=instructions,
                    start_date=parsed_start,
                    schedule_time=parsed_time,
                    every_n_days=every_n_days,
                    is_active=is_active,
                )
            )
        )

    def delete_medication(self, medication_plan_id: int) -> dict[str, Any]:
        self._with_service(lambda _db, user, service: service.delete_medication_plan(user.id, medication_plan_id))
        return {"deleted": True, "medication_plan_id": medication_plan_id}

    def get_medication_history(self) -> dict[str, Any]:
        return self._with_service(
            lambda _db, user, service: {
                "history": [
                    {
                        "medication_dose_instance_id": item.id,
                        "medication_plan_id": item.medication_plan_id,
                        "name": item.name,
                        "instructions": item.instructions,
                        "scheduled_at": item.scheduled_at.isoformat(),
                        "status": item.status.value,
                    }
                    for item in service.repository.get_medication_history(
                        user_id=user.id,
                        before_date=datetime.now().date(),
                    )
                ]
            }
        )

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
                enforce_integration_rate_limit(client)
            except HTTPException:
                return None

            return DaynestMcpAccessToken(
                token=token,
                client_id=str(client.id),
                scopes=[],
                resource=self.resource_server_url,
                auth_source="integration",
                integration_client_id=client.id,
            )
        finally:
            session.close()


class DaynestMcpAccessToken(AccessToken):
    auth_source: Literal["integration", "oidc"]
    integration_client_id: int | None = None
    oidc_subject: str | None = None


class OIDCMcpTokenVerifier(TokenVerifier):
    """Validates Keycloak-issued OIDC tokens for MCP access."""

    def __init__(self, session_factory: Callable[[], Session], *, resource_server_url: str | None = None) -> None:
        self.session_factory = session_factory
        self.resource_server_url = resource_server_url

    async def verify_token(self, token: str) -> AccessToken | None:
        from app.core.oidc import OIDCTokenError, decode_oidc_token, get_or_create_local_user

        try:
            claims = await decode_oidc_token(token)
        except OIDCTokenError as exc:
            logger.debug("OIDC token validation failed: %s", exc)
            return None

        subject: str | None = claims.get("sub")
        if not subject:
            return None

        session = self.session_factory()
        try:
            user = get_or_create_local_user(subject, claims, session)
            if not user.is_active:
                return None
        except Exception as exc:
            logger.warning("Failed to resolve MCP user for subject %s: %s", subject, exc)
            return None
        finally:
            session.close()

        return DaynestMcpAccessToken(
            token=token,
            client_id=subject,
            scopes=[],
            resource=self.resource_server_url,
            auth_source="oidc",
            oidc_subject=subject,
        )


class ComposedTokenVerifier(TokenVerifier):
    """Tries each verifier in order; returns the first successful result."""

    def __init__(self, *verifiers: TokenVerifier) -> None:
        self._verifiers = verifiers

    async def verify_token(self, token: str) -> AccessToken | None:
        for verifier in self._verifiers:
            result = await verifier.verify_token(token)
            if result is not None:
                return result
        return None


def _build_auth_settings(resource_server_url: str) -> AuthSettings:
    issuer_url = settings.oidc_issuer_url or resource_server_url
    return AuthSettings(
        issuer_url=AnyHttpUrl(issuer_url),
        resource_server_url=AnyHttpUrl(resource_server_url),
    )


def _build_transport_security() -> TransportSecuritySettings:
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=settings.trusted_hosts,
        allowed_origins=settings.cors_allow_origins,
    )


def create_mcp_server(backend: DaynestMcpBackend | None = None) -> FastMCP:
    daynest = backend or DaynestMcpBackend(SessionLocal)
    resource_server_url = os.getenv(DAYNEST_MCP_RESOURCE_SERVER_URL_ENV, "http://127.0.0.1:8000/mcp")

    mcp = FastMCP(
        "Daynest",
        json_response=True,
        streamable_http_path="/",  # mounted at /mcp in FastAPI; prefix is stripped before the sub-app sees it
        token_verifier=ComposedTokenVerifier(
            OIDCMcpTokenVerifier(daynest.session_factory, resource_server_url=resource_server_url),
            IntegrationKeyTokenVerifier(daynest.session_factory, resource_server_url=resource_server_url),
        ),
        auth=_build_auth_settings(resource_server_url),
        transport_security=_build_transport_security(),
    )

    @mcp.tool()
    async def whoami(ctx: Context) -> dict[str, Any]:
        """Return the active Daynest user used by this MCP server."""

        await ctx.debug("Resolving authenticated Daynest user")
        return await to_thread.run_sync(daynest.whoami)

    @mcp.tool()
    async def list_users() -> list[dict[str, Any]]:
        """List local Daynest users to help choose DAYNEST_USER_EMAIL when multiple accounts exist."""

        return await to_thread.run_sync(daynest.list_users)

    @mcp.tool()
    async def list_integration_clients() -> list[dict[str, Any]]:
        """List integration clients for the active Daynest user."""

        return await to_thread.run_sync(daynest.list_integration_clients)

    @mcp.tool()
    async def create_integration_client(
        name: str,
        rate_limit_per_minute: int = 120,
    ) -> dict[str, Any]:
        """Create a personal access token (integration client) and return its one-time API key."""

        return await to_thread.run_sync(daynest.create_integration_client, name, rate_limit_per_minute)

    @mcp.tool()
    async def get_today(for_date: str = "today") -> dict[str, Any]:
        """Return the Daynest Today payload for a given date in YYYY-MM-DD format or 'today'."""

        return await to_thread.run_sync(daynest.get_today, for_date)

    @mcp.tool()
    async def get_calendar_day(for_date: str = "today") -> dict[str, Any]:
        """Return the Daynest calendar day view for a date in YYYY-MM-DD format or 'today'."""

        return await to_thread.run_sync(daynest.get_calendar_day, for_date)

    @mcp.tool()
    async def get_calendar_month(year: int, month: int) -> dict[str, Any]:
        """Return the Daynest calendar month summary for a year and month."""

        return await to_thread.run_sync(daynest.get_calendar_month, year, month)

    @mcp.tool()
    async def list_planned_items(start_date: str | None = None, end_date: str | None = None) -> list[dict[str, Any]]:
        """List planned items, optionally filtered by inclusive start and end dates in YYYY-MM-DD format."""

        return await to_thread.run_sync(daynest.list_planned_items, start_date, end_date)

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

        return await to_thread.run_sync(
            daynest.create_planned_item,
            title,
            planned_for,
            notes,
            module_key,
            recurrence_hint,
            linked_source,
            linked_ref,
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

        return await to_thread.run_sync(
            daynest.update_planned_item,
            planned_item_id,
            title,
            planned_for,
            is_done,
            notes,
            module_key,
            recurrence_hint,
            linked_source,
            linked_ref,
        )

    @mcp.tool()
    async def delete_planned_item(planned_item_id: int) -> dict[str, Any]:
        """Delete a planned Daynest item by id."""

        return await to_thread.run_sync(daynest.delete_planned_item, planned_item_id)

    @mcp.tool()
    async def complete_chore(chore_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest chore instance as completed."""

        return await to_thread.run_sync(daynest.complete_chore, chore_instance_id)

    @mcp.tool()
    async def skip_chore(chore_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest chore instance as skipped."""

        return await to_thread.run_sync(daynest.skip_chore, chore_instance_id)

    @mcp.tool()
    async def reschedule_chore(chore_instance_id: int, scheduled_date: str) -> dict[str, Any]:
        """Reschedule a Daynest chore instance to a new YYYY-MM-DD date."""

        return await to_thread.run_sync(daynest.reschedule_chore, chore_instance_id, scheduled_date)

    @mcp.tool()
    async def start_routine_task(task_instance_id: int) -> dict[str, Any]:
        """Start a Daynest routine task."""

        return await to_thread.run_sync(daynest.start_routine_task, task_instance_id)

    @mcp.tool()
    async def complete_routine_task(task_instance_id: int) -> dict[str, Any]:
        """Complete a Daynest routine task."""

        return await to_thread.run_sync(daynest.complete_routine_task, task_instance_id)

    @mcp.tool()
    async def skip_routine_task(task_instance_id: int) -> dict[str, Any]:
        """Skip a Daynest routine task."""

        return await to_thread.run_sync(daynest.skip_routine_task, task_instance_id)

    @mcp.tool()
    async def list_routines() -> list[dict[str, Any]]:
        """List all Daynest routine templates for the active user."""

        return await to_thread.run_sync(daynest.list_routines)

    @mcp.tool()
    async def create_routine(
        name: str,
        start_date: str,
        every_n_days: int = 1,
        description: str | None = None,
        due_time: str | None = None,
        is_active: bool = True,
    ) -> dict[str, Any]:
        """Create a new Daynest routine template.

        Args:
            name: Routine name (e.g. "Morning walk").
            start_date: When the routine starts in YYYY-MM-DD format or 'today'.
            every_n_days: Recurrence frequency — 1 means daily, 7 means weekly, etc.
            description: Optional description of the routine.
            due_time: Optional time-of-day deadline in HH:MM or HH:MM:SS format.
            is_active: Whether the routine is currently active.
        """

        return await to_thread.run_sync(daynest.create_routine, name, start_date, every_n_days, description, due_time, is_active)

    @mcp.tool()
    async def update_routine(
        routine_template_id: int,
        name: str,
        start_date: str,
        every_n_days: int | None = None,
        description: str | None = None,
        due_time: str | None = None,
        is_active: bool | None = None,
    ) -> dict[str, Any]:
        """Update an existing Daynest routine template.

        Args:
            routine_template_id: ID of the routine template to update.
            name: Updated routine name.
            start_date: Updated start date in YYYY-MM-DD format or 'today'.
            every_n_days: Updated recurrence frequency. Omit to keep the current value.
            description: Updated description.
            due_time: Updated time-of-day deadline in HH:MM or HH:MM:SS format. Omit to keep the current value.
            is_active: Set to false to deactivate the routine. Omit to keep the current value.
        """

        return await to_thread.run_sync(
            daynest.update_routine, routine_template_id, name, start_date, every_n_days, description, due_time, is_active
        )

    @mcp.tool()
    async def delete_routine(routine_template_id: int) -> dict[str, Any]:
        """Delete a Daynest routine template by id."""

        return await to_thread.run_sync(daynest.delete_routine, routine_template_id)

    @mcp.tool()
    async def list_chore_templates() -> list[dict[str, Any]]:
        """List all Daynest chore templates for the active user."""

        return await to_thread.run_sync(daynest.list_chore_templates)

    @mcp.tool()
    async def create_chore_template(
        name: str,
        start_date: str,
        every_n_days: int = 1,
        description: str | None = None,
        is_active: bool = True,
    ) -> dict[str, Any]:
        """Create a new Daynest chore template.

        Args:
            name: Chore name (e.g. "Take out trash").
            start_date: When the chore starts in YYYY-MM-DD format or 'today'.
            every_n_days: Recurrence frequency — 1 means daily, 7 means weekly, etc.
            description: Optional description of the chore.
            is_active: Whether the chore is currently active.
        """

        return await to_thread.run_sync(daynest.create_chore_template, name, start_date, every_n_days, description, is_active)

    @mcp.tool()
    async def update_chore_template(
        chore_template_id: int,
        name: str,
        start_date: str,
        every_n_days: int | None = None,
        description: str | None = None,
        is_active: bool | None = None,
    ) -> dict[str, Any]:
        """Update an existing Daynest chore template.

        Args:
            chore_template_id: ID of the chore template to update.
            name: Updated chore name.
            start_date: Updated start date in YYYY-MM-DD format or 'today'.
            every_n_days: Updated recurrence frequency. Omit to keep the current value.
            description: Updated description.
            is_active: Set to false to deactivate the chore. Omit to keep the current value.
        """

        return await to_thread.run_sync(
            daynest.update_chore_template, chore_template_id, name, start_date, every_n_days, description, is_active
        )

    @mcp.tool()
    async def delete_chore_template(chore_template_id: int) -> dict[str, Any]:
        """Delete a Daynest chore template by id."""

        return await to_thread.run_sync(daynest.delete_chore_template, chore_template_id)

    @mcp.tool()
    async def take_medication_dose(medication_dose_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest medication dose as taken. Accepts doses in scheduled or missed status."""

        return await to_thread.run_sync(daynest.take_medication_dose, medication_dose_instance_id)

    @mcp.tool()
    async def skip_medication_dose(medication_dose_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest medication dose as skipped. Accepts doses in scheduled or missed status."""

        return await to_thread.run_sync(daynest.skip_medication_dose, medication_dose_instance_id)

    @mcp.tool()
    async def list_medications() -> list[dict[str, Any]]:
        """List all Daynest medication plans for the active user."""

        return await to_thread.run_sync(daynest.list_medications)

    @mcp.tool()
    async def create_medication(
        name: str,
        instructions: str,
        start_date: str,
        schedule_time: str,
        every_n_days: int = 1,
    ) -> dict[str, Any]:
        """Create a new Daynest medication plan.

        Args:
            name: Medication name (e.g. "Vitamin D").
            instructions: How to take the medication (e.g. "Take with breakfast").
            start_date: When to start the plan in YYYY-MM-DD format.
            schedule_time: Time-of-day for each dose in HH:MM or HH:MM:SS format (e.g. "09:00").
            every_n_days: Dose frequency — 1 means daily, 2 means every other day, etc.
        """

        return await to_thread.run_sync(
            daynest.create_medication,
            name,
            instructions,
            start_date,
            schedule_time,
            every_n_days,
        )

    @mcp.tool()
    async def update_medication(
        medication_plan_id: int,
        name: str,
        instructions: str,
        start_date: str,
        schedule_time: str,
        every_n_days: int | None = None,
        is_active: bool | None = None,
    ) -> dict[str, Any]:
        """Update an existing Daynest medication plan.

        Args:
            medication_plan_id: ID of the medication plan to update.
            name: Updated medication name.
            instructions: Updated instructions.
            start_date: Updated start date in YYYY-MM-DD format.
            schedule_time: Updated time-of-day for each dose in HH:MM or HH:MM:SS format.
            every_n_days: Updated dose frequency. Omit to keep the current value.
            is_active: Set to false to deactivate (pause) the medication plan. Omit to keep the current value.
        """

        return await to_thread.run_sync(
            daynest.update_medication,
            medication_plan_id,
            name,
            instructions,
            start_date,
            schedule_time,
            every_n_days,
            is_active,
        )

    @mcp.tool()
    async def delete_medication(medication_plan_id: int) -> dict[str, Any]:
        """Delete a Daynest medication plan by id."""

        return await to_thread.run_sync(daynest.delete_medication, medication_plan_id)

    @mcp.tool()
    async def get_medication_history() -> dict[str, Any]:
        """Return recent medication dose history for the active user."""

        return await to_thread.run_sync(daynest.get_medication_history)

    @mcp.resource("daynest://today/{for_date}")
    async def today_resource(for_date: str) -> str:
        """Read the Daynest Today payload as a JSON resource."""

        return json.dumps(await to_thread.run_sync(daynest.get_today, for_date), indent=2)

    @mcp.resource("daynest://calendar/day/{for_date}")
    async def calendar_day_resource(for_date: str) -> str:
        """Read the Daynest day view as a JSON resource."""

        return json.dumps(await to_thread.run_sync(daynest.get_calendar_day, for_date), indent=2)

    @mcp.prompt()
    def daily_briefing(for_date: str = "today") -> str:
        """Generate a prompt for reviewing a Daynest day plan."""

        return (
            "Review the Daynest schedule for "
            f"{for_date}. Summarize the priorities, flag overdue chores, "
            "note due medications, and propose a concise execution order."
        )

    return mcp


def main() -> None:
    mcp = create_mcp_server()
    logger.info("Starting Daynest MCP server (stdio)")
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
