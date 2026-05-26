from __future__ import annotations

import json
import logging
import os
import sys
from collections.abc import Callable
from contextlib import contextmanager
from datetime import date, datetime, time
from secrets import token_urlsafe
from typing import Any, Literal, TypeVar, cast

from anyio import to_thread
from fastapi import HTTPException
from fastmcp import Context, FastMCP
from fastmcp.server.auth import AccessToken, MultiAuth, TokenVerifier
from fastmcp.server.auth.providers.keycloak import KeycloakAuthProvider
from fastmcp.server.dependencies import get_access_token
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.integration_auth import (
    enforce_integration_rate_limit,
    get_integration_client_by_token_hash,
    hash_integration_key,
)
from app.core.config import settings
from app.core.enums import Priority
from app.core.oidc import get_or_create_local_user
from app.db.session import SessionLocal
from app.models.integration_client import IntegrationClient
from app.models.user import User
from app.repositories.analytics_repository import get_scheduling_suggestions as build_scheduling_suggestions
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


def _parse_time(value: str | None) -> time | None:
    if not value:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    raise ValueError(f"Invalid time '{value}'. Expected HH:MM or HH:MM:SS format.")


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
            auth_source = access_token.claims.get("auth_source")

            if auth_source == "integration":
                integration_client_id = access_token.claims.get("integration_client_id")
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

            # OIDC path: KeycloakAuthProvider sets standard JWT claims including sub
            oidc_subject = access_token.claims.get("sub")
            if not oidc_subject:
                raise ValueError("Authenticated MCP OIDC token is missing a subject")
            user = get_or_create_local_user(oidc_subject, access_token.claims, db)
            if not user.is_active:
                raise ValueError(f"User for OIDC subject {oidc_subject} is inactive")
            return user

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
        if access_token is not None and access_token.claims.get("auth_source") == "integration":
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
        time_of_day: str | None = None,
        duration_minutes: int | None = None,
        notes: str | None = None,
        module_key: PlannedItemModuleKey | None = None,
        recurrence_hint: str | None = None,
        rrule: str | None = None,
        linked_source: str | None = None,
        linked_ref: str | None = None,
        priority: str = "normal",
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        request = PlannedItemCreateRequest(
            title=title,
            planned_for=_parse_date(planned_for),
            time_of_day=_parse_time(time_of_day),
            duration_minutes=duration_minutes,
            notes=notes,
            module_key=module_key,
            recurrence_hint=recurrence_hint,
            rrule=rrule,
            linked_source=linked_source,
            linked_ref=linked_ref,
            priority=Priority(priority),
            tags=tags or [],
        )
        return self._with_service(lambda _db, user, service: _jsonable(service.create_planned_item(user.id, request)))

    def update_planned_item(
        self,
        planned_item_id: int,
        title: str | None = None,
        planned_for: str | None = None,
        time_of_day: str | None = None,
        duration_minutes: int | None = None,
        is_done: bool | None = None,
        notes: str | None = None,
        module_key: PlannedItemModuleKey | None = None,
        recurrence_hint: str | None = None,
        rrule: str | None = None,
        linked_source: str | None = None,
        linked_ref: str | None = None,
        priority: str | None = None,
        tags: list[str] | None = None,
        scope: Literal["this", "future", "all"] = "this",
    ) -> dict[str, Any]:
        def _operation(_db: Session, user: User, service: TodayService) -> dict[str, Any]:
            existing = service.repository.get_planned_item_for_user(user_id=user.id, planned_item_id=planned_item_id)
            if existing is None:
                raise HTTPException(status_code=404, detail="Planned item not found")
            request = PlannedItemUpdateRequest(
                title=title if title is not None else existing.title,
                planned_for=_parse_date(planned_for) if planned_for is not None else existing.planned_for,
                time_of_day=_parse_time(time_of_day) if time_of_day is not None else existing.time_of_day,
                duration_minutes=None if duration_minutes == 0 else (duration_minutes if duration_minutes is not None else existing.duration_minutes),
                is_done=is_done if is_done is not None else existing.is_done,
                notes=notes if notes is not None else existing.notes,
                module_key=module_key if module_key is not None else cast(PlannedItemModuleKey | None, existing.module_key),
                recurrence_hint=recurrence_hint if recurrence_hint is not None else existing.recurrence_hint,
                rrule=rrule if rrule is not None else existing.rrule,
                linked_source=linked_source if linked_source is not None else existing.linked_source,
                linked_ref=linked_ref if linked_ref is not None else existing.linked_ref,
                priority=Priority(priority) if priority is not None else existing.priority,
                tags=tags if tags is not None else (existing.tags or []),
            )
            return _jsonable(service.update_planned_item(user.id, planned_item_id, request, scope=scope))

        return self._with_service(_operation)

    def defer_planned_item(self, planned_item_id: int, days: int = 1) -> dict[str, Any]:
        return self._with_service(lambda _db, user, service: _jsonable(service.defer_planned_item(user.id, planned_item_id, days)))

    def delete_planned_item(self, planned_item_id: int, scope: Literal["this", "future"] = "this") -> dict[str, Any]:
        self._with_service(lambda _db, user, service: service.delete_planned_item(user.id, planned_item_id, scope=scope))
        return {"deleted": True, "planned_item_id": planned_item_id, "scope": scope}

    def delete_planned_item_series(self, recurrence_series_id: str) -> dict[str, Any]:
        count = self._with_service(lambda _db, user, service: service.delete_planned_item_series(user.id, recurrence_series_id))
        return {"deleted": True, "recurrence_series_id": recurrence_series_id, "deleted_count": count}

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

        def _do(_db: Any, user: Any, service: Any) -> dict[str, Any]:
            existing = service.repository.get_routine_template_for_user(user.id, routine_template_id)
            return _routine_template_to_dict(
                service.update_routine_template(
                    user.id,
                    routine_template_id,
                    name=name,
                    start_date=parsed_start,
                    every_n_days=every_n_days,
                    rrule=existing.rrule if existing else None,
                    description=description,
                    due_time=parsed_due_time,
                    is_active=is_active,
                )
            )

        return self._with_service(_do)

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

        def _do(_db: Any, user: Any, service: Any) -> dict[str, Any]:
            existing = service.repository.get_chore_template_for_user(user.id, chore_template_id)
            return _chore_template_to_dict(
                service.update_chore_template(
                    user.id,
                    chore_template_id,
                    name=name,
                    start_date=parsed_start,
                    every_n_days=every_n_days,
                    rrule=existing.rrule if existing else None,
                    priority=existing.priority if existing else Priority.normal,
                    tags=existing.tags if existing else [],
                    description=description,
                    is_active=is_active,
                )
            )

        return self._with_service(_do)

    def delete_chore_template(self, chore_template_id: int) -> dict[str, Any]:
        self._with_service(lambda _db, user, service: service.delete_chore_template(user.id, chore_template_id))
        return {"deleted": True, "chore_template_id": chore_template_id}

    def take_medication_dose(self, medication_dose_instance_id: int, taken_at: str | None = None) -> dict[str, Any]:
        parsed_taken_at: datetime | None = None
        if taken_at is not None:
            try:
                parsed_taken_at = datetime.fromisoformat(taken_at)
            except ValueError:
                raise ValueError(f"Invalid taken_at format: '{taken_at}'. Expected ISO 8601 datetime.")
        return self._mutate_medication(medication_dose_instance_id, "take", taken_at=parsed_taken_at)

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

    def get_medication_history(self, limit: int = 20, medication_plan_id: int | None = None) -> dict[str, Any]:
        capped_limit = min(max(1, limit), 365)
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
                        limit=capped_limit,
                        medication_plan_id=medication_plan_id,
                    )
                ]
            }
        )

    def skip_missed_medication_doses(self, before_date: str | None = None) -> dict[str, Any]:
        parsed = _parse_date(before_date) if before_date else None
        def _operation(_db: Session, user: User, service: TodayService) -> dict[str, Any]:
            count, cutoff = service.skip_missed_medication_doses(user_id=user.id, before_date=parsed)
            return {"skipped_count": count, "before_date": cutoff.isoformat()}
        return self._with_service(_operation)

    def get_scheduling_suggestions(self, for_date: str | None = None) -> dict[str, Any]:
        parsed_date = _parse_date(for_date) if for_date else date.today()
        with self._session_scope() as db:
            user = self.resolve_user(db)
            suggestions = build_scheduling_suggestions(db, user.id, parsed_date)
            return {
                "for_date": parsed_date.isoformat(),
                "suggestions": [item.model_dump(mode="json") for item in suggestions],
            }

    def _mutate_medication(self, medication_dose_instance_id: int, action: str, *, taken_at: datetime | None = None) -> dict[str, Any]:
        def _operation(_db: Session, user: User, service: TodayService) -> dict[str, Any]:
            instance = service.mutate_medication_status(user.id, medication_dose_instance_id, action, taken_at=taken_at)
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
        super().__init__(resource_base_url=resource_server_url)
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

            return AccessToken(
                token=token,
                client_id=str(client.id),
                scopes=[],
                claims={
                    "auth_source": "integration",
                    "integration_client_id": client.id,
                },
            )
        finally:
            session.close()


def create_mcp_server(backend: DaynestMcpBackend | None = None) -> FastMCP:
    daynest = backend or DaynestMcpBackend(SessionLocal)
    resource_server_url = os.getenv(DAYNEST_MCP_RESOURCE_SERVER_URL_ENV, "http://127.0.0.1:8000/mcp")
    integration_verifier = IntegrationKeyTokenVerifier(daynest.session_factory, resource_server_url=resource_server_url)

    if settings.oidc_issuer_url:
        # Requires Keycloak >= 26.6.0. When audience is set, a matching audience
        # mapper must be configured in the realm or token validation will fail.
        logger.info(
            "MCP: Keycloak auth enabled (realm=%s, audience=%r)",
            settings.oidc_issuer_url,
            settings.oidc_audience,
        )
        keycloak_provider = KeycloakAuthProvider(
            realm_url=settings.oidc_issuer_url,
            base_url=resource_server_url,
            audience=settings.oidc_audience,
        )
        auth: MultiAuth | IntegrationKeyTokenVerifier = MultiAuth(server=keycloak_provider, verifiers=[integration_verifier])
    else:
        auth = integration_verifier

    _build_version = os.getenv("BUILD_VERSION", "dev")
    mcp = FastMCP(
        "Daynest",
        version=_build_version,
        auth=auth,
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
        time_of_day: str | None = None,
        duration_minutes: int | None = None,
        notes: str | None = None,
        module_key: PlannedItemModuleKey | None = None,
        recurrence_hint: str | None = None,
        rrule: str | None = None,
        linked_source: str | None = None,
        linked_ref: str | None = None,
        priority: str = "normal",
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create a planned Daynest item.

        Args:
            title: Item title.
            planned_for: Date in YYYY-MM-DD format or 'today'.
            time_of_day: Optional time in HH:MM (24-hour) format, e.g. "10:00". Set to
                express "meeting at 10:00". Enables time-aware day summaries.
            duration_minutes: Optional estimated effort in minutes (positive integer), e.g.
                45. Enables aggregate load reasoning ("~3h 20min today").
            notes: Optional free-text notes.
            module_key: Optional module association.
            recurrence_hint: Human-readable recurrence label (e.g. "every Monday"). Purely
                descriptive — use rrule to drive actual recurrence.
            rrule: RFC 5545 recurrence rule. When supplied, Daynest pre-materialises
                instances within a 365-day horizon from planned_for (hard backstop: 500
                instances). Examples:
                  FREQ=DAILY;INTERVAL=5        every 5 days (~73 instances)
                  FREQ=WEEKLY;BYDAY=MO,TH      every Monday and Thursday (~104 instances)
                  FREQ=WEEKLY;BYDAY=SU         every Sunday (~52 instances)
                  FREQ=MONTHLY;BYDAY=1SA       first Saturday of each month (~12 instances)
                Warning: open-ended high-frequency rules (e.g. FREQ=DAILY without COUNT/UNTIL)
                will generate up to 365 instances. Prefer adding COUNT or UNTIL when the
                recurrence has a known end, or use delete_planned_item_series to clean up.
            linked_source: Optional external source identifier.
            linked_ref: Optional external reference identifier.
            priority: Item priority — one of 'normal', 'high', 'urgent'. Defaults to 'normal'.
            tags: Optional list of free-text tags for filtering and organisation.
        """

        return await to_thread.run_sync(
            daynest.create_planned_item,
            title,
            planned_for,
            time_of_day,
            duration_minutes,
            notes,
            module_key,
            recurrence_hint,
            rrule,
            linked_source,
            linked_ref,
            priority,
            tags,
        )

    @mcp.tool()
    async def update_planned_item(
        planned_item_id: int,
        title: str | None = None,
        planned_for: str | None = None,
        time_of_day: str | None = None,
        duration_minutes: int | None = None,
        is_done: bool | None = None,
        notes: str | None = None,
        module_key: PlannedItemModuleKey | None = None,
        recurrence_hint: str | None = None,
        rrule: str | None = None,
        linked_source: str | None = None,
        linked_ref: str | None = None,
        priority: str | None = None,
        tags: list[str] | None = None,
        scope: Literal["this", "future", "all"] = "this",
    ) -> dict[str, Any]:
        """Update a planned Daynest item.

        Args:
            planned_item_id: ID of the item to update.
            title: Updated title. Omit to keep current value.
            planned_for: Updated date in YYYY-MM-DD format or 'today'. Omit to keep current value.
            time_of_day: Updated time in HH:MM (24-hour) format. Set to express
                "meeting at 10:00". Enables time-aware day summaries. Omit to keep current value;
                pass "" to clear.
            duration_minutes: Updated estimated effort in minutes (positive integer).
                Enables aggregate load reasoning ("~3h 20min today"). Omit to keep current value;
                pass 0 to clear.
            is_done: Mark the item as completed. Omit to keep current value.
            notes: Updated notes. Omit to keep current value.
            module_key: Updated module association. Omit to keep current value.
            recurrence_hint: Human-readable recurrence label. Purely descriptive. Omit to keep current value.
            rrule: RFC 5545 recurrence rule. Setting this on an existing item replaces
                its rule. Omit to keep current value.
            linked_source: Updated external source identifier. Omit to keep current value.
            linked_ref: Updated external reference identifier. Omit to keep current value.
            priority: Item priority — one of 'normal', 'high', 'urgent'. Omit to keep current value.
            tags: Updated list of free-text tags. Omit to keep current value; pass [] to replace with an empty list.
            scope: Recurrence edit scope — 'this' updates one instance, 'future' updates this and future instances, and 'all' updates the whole series.
        """

        return await to_thread.run_sync(
            daynest.update_planned_item,
            planned_item_id,
            title,
            planned_for,
            time_of_day,
            duration_minutes,
            is_done,
            notes,
            module_key,
            recurrence_hint,
            rrule,
            linked_source,
            linked_ref,
            priority,
            tags,
            scope,
        )

    @mcp.tool()
    async def defer_planned_item(planned_item_id: int, days: int = 1) -> dict[str, Any]:
        """Move a planned item forward by N days (default: 1 = tomorrow).

        Args:
            planned_item_id: ID of the planned item to defer.
            days: Number of days to defer by. Use 1 for tomorrow, 7 for next week.
        """

        return await to_thread.run_sync(daynest.defer_planned_item, planned_item_id, days)

    @mcp.tool()
    async def delete_planned_item(planned_item_id: int, scope: Literal["this", "future"] = "this") -> dict[str, Any]:
        """Delete a planned item by id.

        Args:
            planned_item_id: ID of the planned item to delete.
            scope: How much of the series to remove. Valid values:
                "this"   — delete only this single instance (default).
                "future" — delete this instance and all future instances in the
                           same recurrence series. Has no effect for non-recurring items.
        """

        return await to_thread.run_sync(daynest.delete_planned_item, planned_item_id, scope)

    @mcp.tool()
    async def delete_planned_item_series(recurrence_series_id: str) -> dict[str, Any]:
        """Delete all planned items that belong to a recurring series.

        Use this to remove every instance of a recurring item in one call instead of
        deleting each instance individually. The recurrence_series_id is returned by
        create_planned_item when an rrule is supplied.

        Returns the number of deleted instances in deleted_count.
        """

        return await to_thread.run_sync(daynest.delete_planned_item_series, recurrence_series_id)

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
    async def take_medication_dose(
        medication_dose_instance_id: int,
        taken_at: str | None = None,
    ) -> dict[str, Any]:
        """Mark a Daynest medication dose as taken. Accepts doses in scheduled or missed status.

        Args:
            medication_dose_instance_id: ID of the dose instance to mark as taken.
            taken_at: Optional ISO 8601 datetime when the dose was actually taken
                (e.g. "2026-05-24T08:15:00+02:00"). Must not be in the future.
                Defaults to the current time when omitted.
        """

        return await to_thread.run_sync(daynest.take_medication_dose, medication_dose_instance_id, taken_at)

    @mcp.tool()
    async def skip_medication_dose(medication_dose_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest medication dose as skipped. Accepts doses in scheduled or missed status."""

        return await to_thread.run_sync(daynest.skip_medication_dose, medication_dose_instance_id)

    @mcp.tool()
    async def skip_missed_medication_doses(before_date: str | None = None) -> dict[str, Any]:
        """Skip all missed Daynest medication doses before a given date in one call.

        Use this to bulk-dismiss a backlog of missed doses — for example after
        coming back from a trip or after resolving a sync gap.

        Args:
            before_date: Skip all missed doses with scheduled_date strictly before
                this date in YYYY-MM-DD format or 'today'. Defaults to today so
                that today's doses are never touched. Pass an explicit earlier date
                to limit the window further.

        Returns a dict with:
            skipped_count: Number of doses skipped.
            before_date: The cutoff date that was used.
        """

        return await to_thread.run_sync(daynest.skip_missed_medication_doses, before_date)

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
    async def get_medication_history(
        limit: int = 20,
        medication_plan_id: int | None = None,
    ) -> dict[str, Any]:
        """Return medication dose history for the active user.

        Args:
            limit: Number of doses to return, most recent first. Default 20; max 365.
                Use higher values for adherence analysis:
                  limit=7    last week
                  limit=90   quarterly review
                  limit=365  full-year adherence check
            medication_plan_id: When supplied, return history for this medication only.
                Combine with a high limit to get the full history of one medication
                (e.g. limit=90, medication_plan_id=3 → 90 doses of that medication,
                roughly 90 days if taken daily). Omit to get a global slice across all
                medications.
        """

        return await to_thread.run_sync(daynest.get_medication_history, limit, medication_plan_id)

    @mcp.tool()
    async def get_scheduling_suggestions(for_date: str = "today") -> dict[str, Any]:
        """Generate non-intrusive scheduling suggestions based on recent habits."""

        return await to_thread.run_sync(daynest.get_scheduling_suggestions, for_date)

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
