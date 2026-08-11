"""Daynest MCP server: a thin assembler over app.mcp.* domain modules.

Domain logic (identity/integrations, today/calendar/planned items,
routines/chores, medications, shopping/meal planning, and audit reads) lives
in ``app/mcp/<domain>.py``. This module only:

- wires FastMCP authentication (Keycloak OIDC + hashed integration keys);
- defines ``DaynestMcpBackend``, whose methods are one-line delegations into
  the domain modules (kept for backward compatibility — tests and any other
  in-process callers use this class directly rather than the ``@mcp.tool()``
  wrappers, which run domain calls off the event loop via ``to_thread``);
- registers ``@mcp.tool()`` / ``@mcp.resource()`` / ``@mcp.prompt()`` and the
  process entry point.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, cast

from anyio import to_thread
from fastmcp import Context, FastMCP
from fastmcp.server.auth import MultiAuth
from fastmcp.server.auth.providers.keycloak import KeycloakAuthProvider
from fastmcp.server.transforms.search import BM25SearchTransform
from fastmcp.tools.base import Tool
from mcp.types import (
    CompletionArgument,
    CompletionContext,
    PromptReference,
    ResourceTemplateReference,
)
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.mcp import audit as mcp_audit
from app.mcp import households as mcp_households
from app.mcp import identity as mcp_identity
from app.mcp import insights as mcp_insights
from app.mcp import medications as mcp_medications
from app.mcp import planning as mcp_planning
from app.mcp import routines as mcp_routines
from app.mcp import shopping as mcp_shopping
from app.mcp.auth import IntegrationKeyTokenVerifier
from app.mcp.capabilities import tool_annotations, tool_auth
from app.mcp.medications import DEFAULT_MEDICATION_HISTORY_LIMIT
from app.schemas.shopping_list import ShoppingListStatus
from app.schemas.today import PlannedItemModuleKey
from app.services.audit_service import DEFAULT_AUDIT_LIMIT

logger = logging.getLogger(__name__)


def _search_serializer(tools: Sequence[Tool]) -> list[dict[str, Any]]:
    """Preserve callable schemas and Daynest safety metadata in search results."""
    from app.mcp.capabilities import tool_capability

    return [
        {
            "name": tool.name,
            "description": tool.description or "",
            "input_schema": tool.parameters,
            **tool_capability(tool.name),
        }
        for tool in tools
    ]


if not logger.handlers:
    logging.basicConfig(stream=sys.stderr, level=logging.INFO)

DAYNEST_USER_EMAIL_ENV = "DAYNEST_USER_EMAIL"
DAYNEST_MCP_RESOURCE_SERVER_URL_ENV = "DAYNEST_MCP_RESOURCE_SERVER_URL"

MCP_TOOL_NAMES = (
    "whoami",
    "list_users",
    "list_integration_clients",
    "create_integration_client",
    "rotate_integration_client",
    "revoke_integration_client",
    "list_households",
    "get_household",
    "get_today",
    "get_calendar_day",
    "get_calendar_month",
    "list_meal_plans",
    "get_week_plan",
    "set_meal_slot",
    "generate_shopping_list_from_plan",
    "list_shopping_lists",
    "create_shopping_list",
    "add_shopping_item",
    "check_off_shopping_item",
    "get_shopping_list",
    "update_shopping_list",
    "delete_shopping_list",
    "list_planned_items",
    "create_planned_item",
    "update_planned_item",
    "defer_planned_item",
    "delete_planned_item",
    "delete_planned_item_series",
    "complete_chore",
    "skip_chore",
    "reschedule_chore",
    "start_routine_task",
    "complete_routine_task",
    "skip_routine_task",
    "list_routines",
    "create_routine",
    "update_routine",
    "delete_routine",
    "list_chore_templates",
    "create_chore_template",
    "update_chore_template",
    "delete_chore_template",
    "take_medication_dose",
    "skip_medication_dose",
    "skip_missed_medication_doses",
    "list_medications",
    "create_medication",
    "update_medication",
    "delete_medication",
    "get_medication_history",
    "get_scheduling_suggestions",
    "get_analytics_summary",
    "search_daynest",
    "list_audit_entries",
)

MCP_RESOURCE_URIS = (
    "daynest://today/{for_date}",
    "daynest://calendar/day/{for_date}",
)

MCP_PROMPT_NAMES = ("daily_briefing",)


def complete_for_date(
    ref: PromptReference | ResourceTemplateReference,
    argument: CompletionArgument,
    context: CompletionContext | None,
) -> list[str] | None:
    """Suggest valid dates for Daynest's dated prompt and resources."""
    del context
    if argument.name != "for_date":
        return None

    is_daily_briefing = (
        isinstance(ref, PromptReference) and ref.name == "daily_briefing"
    )
    is_dated_resource = (
        isinstance(ref, ResourceTemplateReference) and ref.uri in MCP_RESOURCE_URIS
    )
    if not (is_daily_briefing or is_dated_resource):
        return None

    today = datetime.now(UTC).date()
    candidates = [
        "today",
        *[(today + timedelta(days=offset)).isoformat() for offset in range(8)],
    ]
    return [
        candidate for candidate in candidates if candidate.startswith(argument.value)
    ]


class DaynestMcpBackend:
    """Thin facade over app.mcp.* domain modules.

    Each method resolves the session factory + configured user email once
    and delegates straight into the corresponding domain module function —
    see app/mcp/context.py for the shared session-scoping/service-building
    helpers those functions use, and app/mcp/principal.py for how the
    authenticated user is resolved.
    """

    def __init__(
        self,
        session_factory: Callable[[], Session],
        *,
        user_email: str | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.user_email = user_email

    # --- Identity / integrations -----------------------------------------

    def whoami(self) -> dict[str, Any]:
        return mcp_identity.whoami(self.session_factory, self.user_email)

    def list_users(self) -> list[dict[str, Any]]:
        return mcp_identity.list_users(self.session_factory, self.user_email)

    def list_integration_clients(self) -> list[dict[str, Any]]:
        return mcp_identity.list_integration_clients(
            self.session_factory, self.user_email
        )

    def create_integration_client(
        self, name: str, rate_limit_per_minute: int = 120
    ) -> dict[str, Any]:
        return mcp_identity.create_integration_client(
            self.session_factory,
            self.user_email,
            name=name,
            rate_limit_per_minute=rate_limit_per_minute,
        )

    def rotate_integration_client(self, client_id: int) -> dict[str, Any]:
        return mcp_identity.rotate_integration_client(
            self.session_factory, self.user_email, client_id
        )

    def revoke_integration_client(self, client_id: int) -> dict[str, Any]:
        return mcp_identity.revoke_integration_client(
            self.session_factory, self.user_email, client_id
        )

    def list_households(self) -> list[dict[str, Any]]:
        return mcp_households.list_households(self.session_factory, self.user_email)

    def get_household(self, household_id: int) -> dict[str, Any]:
        return mcp_households.get_household(
            self.session_factory, self.user_email, household_id
        )

    # --- Today / calendar / planned items ----------------------------------

    def get_today(self, for_date: str | None = None) -> dict[str, Any]:
        return mcp_planning.get_today(self.session_factory, self.user_email, for_date)

    def get_calendar_day(self, for_date: str | None = None) -> dict[str, Any]:
        return mcp_planning.get_calendar_day(
            self.session_factory, self.user_email, for_date
        )

    def get_calendar_month(self, year: int, month: int) -> dict[str, Any]:
        return mcp_planning.get_calendar_month(
            self.session_factory, self.user_email, year, month
        )

    def list_planned_items(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        return mcp_planning.list_planned_items(
            self.session_factory, self.user_email, start_date, end_date, limit
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
        return mcp_planning.create_planned_item(
            self.session_factory,
            self.user_email,
            title=title,
            planned_for=planned_for,
            time_of_day=time_of_day,
            duration_minutes=duration_minutes,
            notes=notes,
            module_key=module_key,
            recurrence_hint=recurrence_hint,
            rrule=rrule,
            linked_source=linked_source,
            linked_ref=linked_ref,
            priority=priority,
            tags=tags,
        )

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
        return mcp_planning.update_planned_item(
            self.session_factory,
            self.user_email,
            planned_item_id=planned_item_id,
            title=title,
            planned_for=planned_for,
            time_of_day=time_of_day,
            duration_minutes=duration_minutes,
            is_done=is_done,
            notes=notes,
            module_key=module_key,
            recurrence_hint=recurrence_hint,
            rrule=rrule,
            linked_source=linked_source,
            linked_ref=linked_ref,
            priority=priority,
            tags=tags,
            scope=scope,
        )

    def defer_planned_item(self, planned_item_id: int, days: int = 1) -> dict[str, Any]:
        return mcp_planning.defer_planned_item(
            self.session_factory, self.user_email, planned_item_id, days
        )

    def delete_planned_item(
        self, planned_item_id: int, scope: Literal["this", "future"] = "this"
    ) -> dict[str, Any]:
        return mcp_planning.delete_planned_item(
            self.session_factory, self.user_email, planned_item_id, scope
        )

    def delete_planned_item_series(self, recurrence_series_id: str) -> dict[str, Any]:
        return mcp_planning.delete_planned_item_series(
            self.session_factory, self.user_email, recurrence_series_id
        )

    def get_scheduling_suggestions(self, for_date: str | None = None) -> dict[str, Any]:
        return mcp_planning.get_scheduling_suggestions(
            self.session_factory, self.user_email, for_date
        )

    # --- Routines / chores ---------------------------------------------------

    def complete_chore(self, chore_instance_id: int) -> dict[str, Any]:
        return mcp_routines.complete_chore(
            self.session_factory, self.user_email, chore_instance_id
        )

    def skip_chore(self, chore_instance_id: int) -> dict[str, Any]:
        return mcp_routines.skip_chore(
            self.session_factory, self.user_email, chore_instance_id
        )

    def reschedule_chore(
        self, chore_instance_id: int, scheduled_date: str
    ) -> dict[str, Any]:
        return mcp_routines.reschedule_chore(
            self.session_factory, self.user_email, chore_instance_id, scheduled_date
        )

    def start_routine_task(self, task_instance_id: int) -> dict[str, Any]:
        return mcp_routines.start_routine_task(
            self.session_factory, self.user_email, task_instance_id
        )

    def complete_routine_task(self, task_instance_id: int) -> dict[str, Any]:
        return mcp_routines.complete_routine_task(
            self.session_factory, self.user_email, task_instance_id
        )

    def skip_routine_task(self, task_instance_id: int) -> dict[str, Any]:
        return mcp_routines.skip_routine_task(
            self.session_factory, self.user_email, task_instance_id
        )

    def list_routines(self) -> list[dict[str, Any]]:
        return mcp_routines.list_routines(self.session_factory, self.user_email)

    def create_routine(
        self,
        name: str,
        start_date: str,
        every_n_days: int = 1,
        description: str | None = None,
        due_time: str | None = None,
        is_active: bool = True,
    ) -> dict[str, Any]:
        return mcp_routines.create_routine(
            self.session_factory,
            self.user_email,
            name=name,
            start_date=start_date,
            every_n_days=every_n_days,
            description=description,
            due_time=due_time,
            is_active=is_active,
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
        return mcp_routines.update_routine(
            self.session_factory,
            self.user_email,
            routine_template_id=routine_template_id,
            name=name,
            start_date=start_date,
            every_n_days=every_n_days,
            description=description,
            due_time=due_time,
            is_active=is_active,
        )

    def delete_routine(self, routine_template_id: int) -> dict[str, Any]:
        return mcp_routines.delete_routine(
            self.session_factory, self.user_email, routine_template_id
        )

    def list_chore_templates(self) -> list[dict[str, Any]]:
        return mcp_routines.list_chore_templates(self.session_factory, self.user_email)

    def create_chore_template(
        self,
        name: str,
        start_date: str,
        every_n_days: int = 1,
        description: str | None = None,
        is_active: bool = True,
    ) -> dict[str, Any]:
        return mcp_routines.create_chore_template(
            self.session_factory,
            self.user_email,
            name=name,
            start_date=start_date,
            every_n_days=every_n_days,
            description=description,
            is_active=is_active,
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
        return mcp_routines.update_chore_template(
            self.session_factory,
            self.user_email,
            chore_template_id=chore_template_id,
            name=name,
            start_date=start_date,
            every_n_days=every_n_days,
            description=description,
            is_active=is_active,
        )

    def delete_chore_template(self, chore_template_id: int) -> dict[str, Any]:
        return mcp_routines.delete_chore_template(
            self.session_factory, self.user_email, chore_template_id
        )

    # --- Medications -----------------------------------------------------

    def take_medication_dose(
        self, medication_dose_instance_id: int, taken_at: str | None = None
    ) -> dict[str, Any]:
        return mcp_medications.take_medication_dose(
            self.session_factory, self.user_email, medication_dose_instance_id, taken_at
        )

    def skip_medication_dose(self, medication_dose_instance_id: int) -> dict[str, Any]:
        return mcp_medications.skip_medication_dose(
            self.session_factory, self.user_email, medication_dose_instance_id
        )

    def skip_missed_medication_doses(
        self, before_date: str | None = None
    ) -> dict[str, Any]:
        return mcp_medications.skip_missed_medication_doses(
            self.session_factory, self.user_email, before_date
        )

    def list_medications(self) -> list[dict[str, Any]]:
        return mcp_medications.list_medications(self.session_factory, self.user_email)

    def create_medication(
        self,
        name: str,
        instructions: str,
        start_date: str,
        schedule_time: str,
        every_n_days: int = 1,
    ) -> dict[str, Any]:
        return mcp_medications.create_medication(
            self.session_factory,
            self.user_email,
            name=name,
            instructions=instructions,
            start_date=start_date,
            schedule_time=schedule_time,
            every_n_days=every_n_days,
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
        return mcp_medications.update_medication(
            self.session_factory,
            self.user_email,
            medication_plan_id=medication_plan_id,
            name=name,
            instructions=instructions,
            start_date=start_date,
            schedule_time=schedule_time,
            every_n_days=every_n_days,
            is_active=is_active,
        )

    def delete_medication(self, medication_plan_id: int) -> dict[str, Any]:
        return mcp_medications.delete_medication(
            self.session_factory, self.user_email, medication_plan_id
        )

    def get_medication_history(
        self,
        limit: int = DEFAULT_MEDICATION_HISTORY_LIMIT,
        medication_plan_id: int | None = None,
    ) -> dict[str, Any]:
        return mcp_medications.get_medication_history(
            self.session_factory, self.user_email, limit, medication_plan_id
        )

    # --- Shopping / meal planning ------------------------------------------

    def list_meal_plans(self) -> list[dict[str, Any]]:
        return mcp_shopping.list_meal_plans(self.session_factory, self.user_email)

    def get_week_plan(self, meal_plan_id: int) -> dict[str, Any]:
        return mcp_shopping.get_week_plan(
            self.session_factory, self.user_email, meal_plan_id
        )

    def set_meal_slot(
        self,
        meal_plan_id: int,
        slot_id: int,
        title: str | None = None,
        recipe_url: str | None = None,
        ingredients_json: list[str] | None = None,
        planned_item_id: int | None = None,
    ) -> dict[str, Any]:
        return mcp_shopping.set_meal_slot(
            self.session_factory,
            self.user_email,
            meal_plan_id,
            slot_id,
            title,
            recipe_url,
            ingredients_json,
            planned_item_id,
        )

    def generate_shopping_list_from_plan(self, meal_plan_id: int) -> dict[str, Any]:
        return mcp_shopping.generate_shopping_list_from_plan(
            self.session_factory, self.user_email, meal_plan_id
        )

    def list_shopping_lists(
        self, status: ShoppingListStatus | Literal["all"] = "active"
    ) -> list[dict[str, Any]]:
        return mcp_shopping.list_shopping_lists(
            self.session_factory, self.user_email, status
        )

    def create_shopping_list(
        self, name: str, store: str | None = None, notes: str | None = None
    ) -> dict[str, Any]:
        return mcp_shopping.create_shopping_list(
            self.session_factory, self.user_email, name, store, notes
        )

    def get_shopping_list(self, shopping_list_id: int) -> dict[str, Any]:
        return mcp_shopping.get_shopping_list(
            self.session_factory, self.user_email, shopping_list_id
        )

    def update_shopping_list(
        self,
        shopping_list_id: int,
        name: str | None = None,
        store: str | None = None,
        notes: str | None = None,
        status: ShoppingListStatus | None = None,
    ) -> dict[str, Any]:
        return mcp_shopping.update_shopping_list(
            self.session_factory,
            self.user_email,
            shopping_list_id,
            name,
            store,
            notes,
            status,
        )

    def delete_shopping_list(self, shopping_list_id: int) -> dict[str, Any]:
        return mcp_shopping.delete_shopping_list(
            self.session_factory, self.user_email, shopping_list_id
        )

    def add_shopping_item(
        self,
        shopping_list_id: int,
        title: str,
        planned_for: str = "today",
        notes: str | None = None,
        priority: str = "normal",
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        return mcp_shopping.add_shopping_item(
            self.session_factory,
            self.user_email,
            shopping_list_id,
            title,
            planned_for,
            notes,
            priority,
            tags,
        )

    def check_off_shopping_item(
        self, shopping_list_id: int, planned_item_id: int
    ) -> dict[str, Any]:
        return mcp_shopping.check_off_shopping_item(
            self.session_factory, self.user_email, shopping_list_id, planned_item_id
        )

    # --- Insights ------------------------------------------------------

    def get_analytics_summary(
        self, period: Literal["week", "month", "year"] = "week"
    ) -> dict[str, Any]:
        return mcp_insights.get_analytics_summary(
            self.session_factory, self.user_email, period
        )

    def search_daynest(self, query: str, limit: int = 20) -> dict[str, Any]:
        return mcp_insights.search_daynest(
            self.session_factory, self.user_email, query, limit
        )

    # --- Audit ---------------------------------------------------------

    def list_audit_entries(
        self,
        resource_type: str | None = None,
        resource_id: str | None = None,
        action: str | None = None,
        since: str | None = None,
        until: str | None = None,
        limit: int = DEFAULT_AUDIT_LIMIT,
        before_id: int | None = None,
    ) -> dict[str, Any]:
        return mcp_audit.list_audit_entries(
            self.session_factory,
            self.user_email,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            since=since,
            until=until,
            limit=limit,
            before_id=before_id,
        )


def create_mcp_server(backend: DaynestMcpBackend | None = None) -> FastMCP:
    daynest = backend or DaynestMcpBackend(SessionLocal)
    resource_server_url = os.getenv(
        DAYNEST_MCP_RESOURCE_SERVER_URL_ENV, "http://127.0.0.1:8000/mcp"
    )
    integration_verifier = IntegrationKeyTokenVerifier(
        daynest.session_factory, resource_server_url=resource_server_url
    )

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
            required_scopes=[],
        )
        auth: MultiAuth | IntegrationKeyTokenVerifier = MultiAuth(
            server=keycloak_provider, verifiers=[integration_verifier]
        )
    else:
        auth = integration_verifier

    _build_version = os.getenv("BUILD_VERSION", "dev")
    mcp = FastMCP(
        "Daynest",
        version=_build_version,
        instructions="Daynest personal planning tools scoped to the authenticated owner.",
        auth=auth,
        transforms=[
            BM25SearchTransform(
                max_results=10,
                always_visible=["whoami"],
                search_tool_name="search_tools",
                call_tool_name="call_tool",
                search_result_serializer=_search_serializer,
            )
        ],
    )

    def register_tool(fn: Callable[..., Any]) -> Any:
        """Register a tool with explicit client-facing safety annotations."""
        tool_name = cast(Any, fn).__name__
        return mcp.tool(
            annotations=tool_annotations(tool_name),
            auth=tool_auth(tool_name),
        )(fn)

    @register_tool
    async def whoami(ctx: Context) -> dict[str, Any]:
        """Return the active Daynest user used by this MCP server."""

        await ctx.debug("Resolving authenticated Daynest user")
        return await to_thread.run_sync(daynest.whoami)

    @register_tool
    async def list_users() -> list[dict[str, Any]]:
        """List local Daynest users to help choose DAYNEST_USER_EMAIL when multiple accounts exist."""

        return await to_thread.run_sync(daynest.list_users)

    @register_tool
    async def list_integration_clients() -> list[dict[str, Any]]:
        """List integration clients for the active Daynest user."""

        return await to_thread.run_sync(daynest.list_integration_clients)

    @register_tool
    async def create_integration_client(
        name: str,
        rate_limit_per_minute: int = 120,
    ) -> dict[str, Any]:
        """Create a personal access token (integration client) and return its one-time API key."""

        return await to_thread.run_sync(
            daynest.create_integration_client, name, rate_limit_per_minute
        )

    @register_tool
    async def rotate_integration_client(client_id: int) -> dict[str, Any]:
        """Rotate an integration client's key and return the new key once."""
        return await to_thread.run_sync(daynest.rotate_integration_client, client_id)

    @register_tool
    async def revoke_integration_client(client_id: int) -> dict[str, Any]:
        """Revoke an integration client owned by the active user."""
        return await to_thread.run_sync(daynest.revoke_integration_client, client_id)

    @register_tool
    async def list_households() -> list[dict[str, Any]]:
        """List households containing the active user and their members."""
        return await to_thread.run_sync(daynest.list_households)

    @register_tool
    async def get_household(household_id: int) -> dict[str, Any]:
        """Get a household when the active user is a member."""
        return await to_thread.run_sync(daynest.get_household, household_id)

    @register_tool
    async def get_today(for_date: str = "today") -> dict[str, Any]:
        """Return the Daynest Today payload for a given date in YYYY-MM-DD format or 'today'."""

        return await to_thread.run_sync(daynest.get_today, for_date)

    @register_tool
    async def get_calendar_day(for_date: str = "today") -> dict[str, Any]:
        """Return the Daynest calendar day view for a date in YYYY-MM-DD format or 'today'."""

        return await to_thread.run_sync(daynest.get_calendar_day, for_date)

    @register_tool
    async def get_calendar_month(year: int, month: int) -> dict[str, Any]:
        """Return the Daynest calendar month summary for a year and month."""

        return await to_thread.run_sync(daynest.get_calendar_month, year, month)

    @register_tool
    async def list_meal_plans() -> list[dict[str, Any]]:
        """List meal plans for the active user."""

        return await to_thread.run_sync(daynest.list_meal_plans)

    @register_tool
    async def get_week_plan(meal_plan_id: int) -> dict[str, Any]:
        """Return a meal plan as a 7-day by 4-slot week grid."""

        return await to_thread.run_sync(daynest.get_week_plan, meal_plan_id)

    @register_tool
    async def set_meal_slot(
        meal_plan_id: int,
        slot_id: int,
        title: str | None = None,
        recipe_url: str | None = None,
        ingredients_json: list[str] | None = None,
        planned_item_id: int | None = None,
    ) -> dict[str, Any]:
        """Update a breakfast, lunch, dinner, or snack slot in a meal plan."""

        return await to_thread.run_sync(
            daynest.set_meal_slot,
            meal_plan_id,
            slot_id,
            title,
            recipe_url,
            ingredients_json,
            planned_item_id,
        )

    @register_tool
    async def generate_shopping_list_from_plan(meal_plan_id: int) -> dict[str, Any]:
        """Generate a shopping list from all ingredients in a meal plan."""

        return await to_thread.run_sync(
            daynest.generate_shopping_list_from_plan, meal_plan_id
        )

    @register_tool
    async def list_shopping_lists(
        status: ShoppingListStatus | Literal["all"] = "active",
    ) -> list[dict[str, Any]]:
        """List shopping lists for the active user. Pass status='all' to include archived lists."""

        return await to_thread.run_sync(daynest.list_shopping_lists, status)

    @register_tool
    async def create_shopping_list(
        name: str, store: str | None = None, notes: str | None = None
    ) -> dict[str, Any]:
        """Create a shopping list for the active user."""

        return await to_thread.run_sync(
            daynest.create_shopping_list, name, store, notes
        )

    @register_tool
    async def get_shopping_list(shopping_list_id: int) -> dict[str, Any]:
        """Get one owner-scoped shopping list and its items."""
        return await to_thread.run_sync(daynest.get_shopping_list, shopping_list_id)

    @register_tool
    async def update_shopping_list(
        shopping_list_id: int,
        name: str | None = None,
        store: str | None = None,
        notes: str | None = None,
        status: ShoppingListStatus | None = None,
    ) -> dict[str, Any]:
        """Update or archive an owner-scoped shopping list."""
        return await to_thread.run_sync(
            daynest.update_shopping_list, shopping_list_id, name, store, notes, status
        )

    @register_tool
    async def delete_shopping_list(shopping_list_id: int) -> dict[str, Any]:
        """Delete an owner-scoped shopping list."""
        return await to_thread.run_sync(daynest.delete_shopping_list, shopping_list_id)

    @register_tool
    async def add_shopping_item(
        shopping_list_id: int,
        title: str,
        planned_for: str = "today",
        notes: str | None = None,
        priority: str = "normal",
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        """Add an item to a shopping list using Daynest planned-items storage."""

        return await to_thread.run_sync(
            daynest.add_shopping_item,
            shopping_list_id,
            title,
            planned_for,
            notes,
            priority,
            tags,
        )

    @register_tool
    async def check_off_shopping_item(
        shopping_list_id: int, planned_item_id: int
    ) -> dict[str, Any]:
        """Mark a shopping-list planned item as in cart / purchased."""

        return await to_thread.run_sync(
            daynest.check_off_shopping_item, shopping_list_id, planned_item_id
        )

    @register_tool
    async def list_planned_items(
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """List planned items, optionally filtered by inclusive start and end dates in YYYY-MM-DD format.

        Args:
            start_date: Optional inclusive start date in YYYY-MM-DD format.
            end_date: Optional inclusive end date in YYYY-MM-DD format.
            limit: Maximum items to return. Defaults to 100; capped at 1000
                regardless of what is requested. When neither start_date nor
                end_date is given, defaults to the 100 most recent items
                instead of the user's entire all-time history.
        """

        return await to_thread.run_sync(
            daynest.list_planned_items, start_date, end_date, limit
        )

    @register_tool
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

    @register_tool
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

    @register_tool
    async def defer_planned_item(planned_item_id: int, days: int = 1) -> dict[str, Any]:
        """Move a planned item forward by N days (default: 1 = tomorrow).

        Args:
            planned_item_id: ID of the planned item to defer.
            days: Number of days to defer by. Use 1 for tomorrow, 7 for next week.
        """

        return await to_thread.run_sync(
            daynest.defer_planned_item, planned_item_id, days
        )

    @register_tool
    async def delete_planned_item(
        planned_item_id: int, scope: Literal["this", "future"] = "this"
    ) -> dict[str, Any]:
        """Delete a planned item by id.

        Args:
            planned_item_id: ID of the planned item to delete.
            scope: How much of the series to remove. Valid values:
                "this"   — delete only this single instance (default).
                "future" — delete this instance and all future instances in the
                           same recurrence series. Has no effect for non-recurring items.
        """

        return await to_thread.run_sync(
            daynest.delete_planned_item, planned_item_id, scope
        )

    @register_tool
    async def delete_planned_item_series(recurrence_series_id: str) -> dict[str, Any]:
        """Delete all planned items that belong to a recurring series.

        Use this to remove every instance of a recurring item in one call instead of
        deleting each instance individually. The recurrence_series_id is returned by
        create_planned_item when an rrule is supplied.

        Returns the number of deleted instances in deleted_count.
        """

        return await to_thread.run_sync(
            daynest.delete_planned_item_series, recurrence_series_id
        )

    @register_tool
    async def complete_chore(chore_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest chore instance as completed."""

        return await to_thread.run_sync(daynest.complete_chore, chore_instance_id)

    @register_tool
    async def skip_chore(chore_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest chore instance as skipped."""

        return await to_thread.run_sync(daynest.skip_chore, chore_instance_id)

    @register_tool
    async def reschedule_chore(
        chore_instance_id: int, scheduled_date: str
    ) -> dict[str, Any]:
        """Reschedule a Daynest chore instance to a new YYYY-MM-DD date."""

        return await to_thread.run_sync(
            daynest.reschedule_chore, chore_instance_id, scheduled_date
        )

    @register_tool
    async def start_routine_task(task_instance_id: int) -> dict[str, Any]:
        """Start a Daynest routine task."""

        return await to_thread.run_sync(daynest.start_routine_task, task_instance_id)

    @register_tool
    async def complete_routine_task(task_instance_id: int) -> dict[str, Any]:
        """Complete a Daynest routine task."""

        return await to_thread.run_sync(daynest.complete_routine_task, task_instance_id)

    @register_tool
    async def skip_routine_task(task_instance_id: int) -> dict[str, Any]:
        """Skip a Daynest routine task."""

        return await to_thread.run_sync(daynest.skip_routine_task, task_instance_id)

    @register_tool
    async def list_routines() -> list[dict[str, Any]]:
        """List all Daynest routine templates for the active user."""

        return await to_thread.run_sync(daynest.list_routines)

    @register_tool
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

        return await to_thread.run_sync(
            daynest.create_routine,
            name,
            start_date,
            every_n_days,
            description,
            due_time,
            is_active,
        )

    @register_tool
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
            daynest.update_routine,
            routine_template_id,
            name,
            start_date,
            every_n_days,
            description,
            due_time,
            is_active,
        )

    @register_tool
    async def delete_routine(routine_template_id: int) -> dict[str, Any]:
        """Delete a Daynest routine template by id."""

        return await to_thread.run_sync(daynest.delete_routine, routine_template_id)

    @register_tool
    async def list_chore_templates() -> list[dict[str, Any]]:
        """List all Daynest chore templates for the active user."""

        return await to_thread.run_sync(daynest.list_chore_templates)

    @register_tool
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

        return await to_thread.run_sync(
            daynest.create_chore_template,
            name,
            start_date,
            every_n_days,
            description,
            is_active,
        )

    @register_tool
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
            daynest.update_chore_template,
            chore_template_id,
            name,
            start_date,
            every_n_days,
            description,
            is_active,
        )

    @register_tool
    async def delete_chore_template(chore_template_id: int) -> dict[str, Any]:
        """Delete a Daynest chore template by id."""

        return await to_thread.run_sync(
            daynest.delete_chore_template, chore_template_id
        )

    @register_tool
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

        return await to_thread.run_sync(
            daynest.take_medication_dose, medication_dose_instance_id, taken_at
        )

    @register_tool
    async def skip_medication_dose(medication_dose_instance_id: int) -> dict[str, Any]:
        """Mark a Daynest medication dose as skipped. Accepts doses in scheduled or missed status."""

        return await to_thread.run_sync(
            daynest.skip_medication_dose, medication_dose_instance_id
        )

    @register_tool
    async def skip_missed_medication_doses(
        before_date: str | None = None,
    ) -> dict[str, Any]:
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

        return await to_thread.run_sync(
            daynest.skip_missed_medication_doses, before_date
        )

    @register_tool
    async def list_medications() -> list[dict[str, Any]]:
        """List all Daynest medication plans for the active user."""

        return await to_thread.run_sync(daynest.list_medications)

    @register_tool
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

    @register_tool
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

    @register_tool
    async def delete_medication(medication_plan_id: int) -> dict[str, Any]:
        """Delete a Daynest medication plan by id."""

        return await to_thread.run_sync(daynest.delete_medication, medication_plan_id)

    @register_tool
    async def get_medication_history(
        limit: int = DEFAULT_MEDICATION_HISTORY_LIMIT,
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

        return await to_thread.run_sync(
            daynest.get_medication_history, limit, medication_plan_id
        )

    @register_tool
    async def get_scheduling_suggestions(for_date: str = "today") -> dict[str, Any]:
        """Generate non-intrusive scheduling suggestions based on recent habits."""

        return await to_thread.run_sync(daynest.get_scheduling_suggestions, for_date)

    @register_tool
    async def get_analytics_summary(
        period: Literal["week", "month", "year"] = "week",
    ) -> dict[str, Any]:
        """Summarize chore, routine, medication, and planned-item outcomes."""
        return await to_thread.run_sync(daynest.get_analytics_summary, period)

    @register_tool
    async def search_daynest(query: str, limit: int = 20) -> dict[str, Any]:
        """Search routines, chores, medications, and planned items owned by the caller."""
        return await to_thread.run_sync(daynest.search_daynest, query, limit)

    @register_tool
    async def list_audit_entries(
        resource_type: str | None = None,
        resource_id: str | None = None,
        action: str | None = None,
        since: str | None = None,
        until: str | None = None,
        limit: int = DEFAULT_AUDIT_LIMIT,
        before_id: int | None = None,
    ) -> dict[str, Any]:
        """Return the active Daynest user's own audit-trail entries, newest first.

        Scoped strictly to the authenticated user's own actions — there is no
        cross-user or household-wide visibility. Every REST and MCP mutation
        that writes to Daynest data records a matching entry here in the same
        database transaction as the mutation itself.

        Args:
            resource_type: Optional filter, e.g. "planned_item", "chore_instance",
                "medication_plan", "shopping_list", "routine_template".
            resource_id: Optional filter to a single resource's id.
            action: Optional filter to a specific action, e.g. "planned_item.create".
            since: Optional ISO 8601 datetime (or YYYY-MM-DD) lower bound, inclusive.
            until: Optional ISO 8601 datetime (or YYYY-MM-DD) upper bound, inclusive.
            limit: Maximum entries to return. Must be between 1 and 1000.
            before_id: Exclusive cursor returned by the previous page.
        """

        return await to_thread.run_sync(
            daynest.list_audit_entries,
            resource_type,
            resource_id,
            action,
            since,
            until,
            limit,
            before_id,
        )

    @mcp.resource("daynest://today/{for_date}")
    async def today_resource(for_date: str) -> str:
        """Read the Daynest Today payload as a JSON resource."""

        return json.dumps(
            await to_thread.run_sync(daynest.get_today, for_date), indent=2
        )

    @mcp.resource("daynest://calendar/day/{for_date}")
    async def calendar_day_resource(for_date: str) -> str:
        """Read the Daynest day view as a JSON resource."""

        return json.dumps(
            await to_thread.run_sync(daynest.get_calendar_day, for_date), indent=2
        )

    @mcp.prompt()
    def daily_briefing(for_date: str = "today") -> str:
        """Generate a prompt for reviewing a Daynest day plan."""

        return (
            "Review the Daynest schedule for "
            f"{for_date}. Summarize the priorities, flag overdue chores, "
            "note due medications, and propose a concise execution order."
        )

    mcp.completion(complete_for_date)

    return mcp


def main() -> None:
    mcp = create_mcp_server()
    logger.info("Starting Daynest MCP server (stdio)")
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
