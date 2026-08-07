"""Shared bounds for list/history endpoints exposed over REST and MCP.

Every potentially-unbounded response (list/history tools in particular) must
clamp its ``limit`` through here so a single MCP or REST call can never pull
an unbounded result set into context or across the wire.
"""

from __future__ import annotations

DEFAULT_LIST_LIMIT = 100
MAX_LIST_LIMIT = 1000


def clamp_limit(limit: int | None, *, default: int = DEFAULT_LIST_LIMIT, maximum: int = MAX_LIST_LIMIT) -> int:
    """Clamp a caller-supplied limit to ``[1, maximum]``, defaulting when omitted."""

    if limit is None:
        limit = default
    return min(max(1, limit), maximum)
