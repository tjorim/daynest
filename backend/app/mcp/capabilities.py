"""Shared MCP capability policy for discovery and tests."""

from __future__ import annotations

from fastmcp.server.auth import AuthCheck, AuthContext

from mcp.types import ToolAnnotations

TOOL_EFFECT_READ = "read"
TOOL_EFFECT_WRITE = "write"

_READ_PREFIXES = ("get_", "list_")
_NON_DESTRUCTIVE_WRITE_PREFIXES = ("add_", "create_", "generate_")
_INTERACTIVE_ONLY_TOOLS = frozenset(
    {
        "create_integration_client",
        "list_integration_clients",
        "rotate_integration_client",
        "revoke_integration_client",
        "list_users",
    }
)


def tool_effect(tool_name: str) -> str:
    """Classify unknown tool names conservatively as writes."""
    if tool_name == "whoami" or tool_name.startswith(_READ_PREFIXES):
        return TOOL_EFFECT_READ
    return TOOL_EFFECT_WRITE


def tool_capability(tool_name: str) -> dict[str, str]:
    """Return authorization and side-effect metadata for a registered tool."""
    return {
        "name": tool_name,
        "effect": tool_effect(tool_name),
        "required_tier": "owner",
        "required_auth": "interactive"
        if tool_name in _INTERACTIVE_ONLY_TOOLS
        else "user_or_integration",
    }


def _require_interactive_auth(ctx: AuthContext) -> bool:
    """Reject managed keys while retaining Daynest's local stdio workflow.

    Authenticated HTTP requests always carry a token because the server auth
    provider rejects them first. A missing token here therefore represents the
    explicitly local stdio transport, where ``DAYNEST_USER_EMAIL`` supplies the
    principal.
    """
    return ctx.token is None or ctx.token.claims.get("auth_source") != "integration"


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
        destructive_hint=not tool_name.startswith(_NON_DESTRUCTIVE_WRITE_PREFIXES),
        open_world_hint=False,
    )
