"""Repairs support for the Daynest integration."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from homeassistant.components.repairs import RepairsFlow
    from homeassistant.core import HomeAssistant


async def async_create_fix_flow(
    hass: HomeAssistant,
    issue_id: str,
    data: dict[str, str] | None,
) -> RepairsFlow:
    """Create a fix flow for a repair issue.

    Currently all Daynest repair issues require manual action (e.g. updating
    the integration), so no automated fix flow is provided.
    """
    raise NotImplementedError(f"No fix flow for Daynest issue {issue_id!r}")
