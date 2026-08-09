"""Shared MCP capability policy for discovery and tests."""

from __future__ import annotations

TOOL_EFFECT_READ = "read"
TOOL_EFFECT_WRITE = "write"

_READ_PREFIXES = ("get_", "list_")
_INTERACTIVE_ONLY_TOOLS = frozenset(
    {"create_integration_client", "list_integration_clients", "list_users"}
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
