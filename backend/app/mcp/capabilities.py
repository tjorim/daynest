"""Shared MCP capability policy for discovery and tests."""

from __future__ import annotations

from typing import Any

from fastmcp.server.auth import AuthCheck, AuthContext

from app.core.config import settings
from mcp.types import ToolAnnotations

TOOL_EFFECT_READ = "read"
TOOL_EFFECT_WRITE = "write"

_READ_PREFIXES = ("get_", "list_")
# Read-only tools whose names do not carry a read prefix.
_READ_TOOLS = frozenset({"whoami", "search_daynest"})
# Write tools that only add data and never overwrite or remove existing data.
# A tool absent from this set is treated as destructive, which is also the
# fallback for any future tool that has not been classified yet.
_ADDITIVE_WRITE_TOOLS = frozenset(
    {
        "create_integration_client",
        "create_shopping_list",
        "add_shopping_item",
        "generate_shopping_list_from_plan",
        "create_planned_item",
        "create_routine",
        "create_chore_template",
        "create_medication",
    }
)
# Writes whose identical repeat leaves state unchanged (docs/retry-safety.md):
# updates set absolute values, deletes are hard deletes that fail as not-found
# on repeat, and status transitions either replay as no-ops or fail with 409
# without writing. Deliberately absent: creates and generation (a new row per
# call), ``defer_planned_item`` (relative), ``rotate_integration_client`` (a new
# key per call) and ``revoke_integration_client`` (every call rewrites
# ``revoked_at`` and appends an audit entry). Unknown tools default to
# non-idempotent.
_IDEMPOTENT_WRITE_TOOLS = frozenset(
    {
        "set_meal_slot",
        "check_off_shopping_item",
        "update_shopping_list",
        "delete_shopping_list",
        "update_planned_item",
        "delete_planned_item",
        "delete_planned_item_series",
        "complete_chore",
        "skip_chore",
        "reschedule_chore",
        "start_routine_task",
        "complete_routine_task",
        "skip_routine_task",
        "update_routine",
        "delete_routine",
        "update_chore_template",
        "delete_chore_template",
        "take_medication_dose",
        "skip_medication_dose",
        "skip_missed_medication_doses",
        "update_medication",
        "delete_medication",
    }
)
CONTRACT_VERSION = 1
_INTERACTIVE_ONLY_TOOLS = frozenset(
    {
        "create_integration_client",
        "list_integration_clients",
        "rotate_integration_client",
        "revoke_integration_client",
        "list_users",
    }
)
_HOUSEHOLD_MEMBER_TOOLS = frozenset({"list_households", "get_household"})


def tool_effect(tool_name: str) -> str:
    """Classify unknown tool names conservatively as writes."""
    if tool_name in _READ_TOOLS or tool_name.startswith(_READ_PREFIXES):
        return TOOL_EFFECT_READ
    return TOOL_EFFECT_WRITE


def tool_capability(tool_name: str) -> dict[str, Any]:
    """Return authorization and side-effect metadata for a registered tool."""
    tier = "household_member" if tool_name in _HOUSEHOLD_MEMBER_TOOLS else "owner"
    auth = "interactive" if tool_name in _INTERACTIVE_ONLY_TOOLS else "user_or_integration"
    return {
        "name": tool_name,
        "effect": tool_effect(tool_name),
        "requires_confirmation": False,
        "access": {"auth": auth, "tier": tier},
    }


def _require_interactive_auth(ctx: AuthContext) -> bool:
    """Reject managed keys while retaining Daynest's local stdio workflow.

    Authenticated HTTP requests always carry a token because the server auth
    provider rejects them first. A missing token here therefore represents the
    explicitly local stdio transport, where ``DAYNEST_USER_EMAIL`` supplies the
    principal.
    """
    if ctx.token is None:
        return True
    claims = ctx.token.claims
    if claims.get("auth_source") in {"integration", "keycloak_service"}:
        return False
    username = claims.get("preferred_username")
    if isinstance(username, str) and username.startswith("service-account-"):
        return False
    interactive_client_ids = {
        client_id.strip() for client_id in settings.mcp_interactive_client_ids.split(",") if client_id.strip()
    }
    return claims.get("azp") in interactive_client_ids


def tool_auth(tool_name: str) -> AuthCheck | None:
    """Return native component authorization for interactive-only tools."""
    return _require_interactive_auth if tool_name in _INTERACTIVE_ONLY_TOOLS else None


def tool_annotations(tool_name: str) -> ToolAnnotations:
    """Return explicit MCP safety metadata for ChatGPT and other clients."""
    if tool_effect(tool_name) == TOOL_EFFECT_READ:
        return ToolAnnotations(
            read_only_hint=True,
            destructive_hint=False,
            idempotent_hint=True,
            open_world_hint=False,
        )

    return ToolAnnotations(
        read_only_hint=False,
        destructive_hint=tool_name not in _ADDITIVE_WRITE_TOOLS,
        idempotent_hint=tool_name in _IDEMPOTENT_WRITE_TOOLS,
        open_world_hint=False,
    )
