"""Standardize expected domain failures into MCP-friendly errors.

Daynest's services currently raise a mix of ``HTTPException`` (REST-era
validation/conflict/not-found errors) and bare ``ValueError`` for the same
kinds of failures (see e.g. ``TodayService.update_medication_plan`` raising
``ValueError`` for "not found" vs. ``TodayService.mutate_medication_status``
raising ``HTTPException`` for the same class of failure). MCP clients don't
understand ``HTTPException`` — FastMCP surfaces whatever exception a tool
raises as the tool-call error, and ``HTTPException``'s default string form is
not a clean, actionable message.

``map_domain_errors`` normalizes the subset of ``HTTPException`` status codes
that represent *expected* domain failures (bad input, conflict, not found)
into ``ValueError``, matching the vocabulary MCP callers (and the existing
test suite) already expect. ``PermissionError`` is left untouched — it's
already a clean, specific signal. Genuinely unexpected exceptions (anything
else) propagate unchanged so they aren't masked as ordinary tool errors.
"""

from __future__ import annotations

import functools
from collections.abc import Callable

from fastapi import HTTPException

# Status codes that represent expected, actionable domain failures rather
# than unexpected server errors. 401/403 are intentionally excluded: Daynest
# raises PermissionError directly for authorization failures today, and
# leaving auth-adjacent HTTPExceptions untranslated avoids silently
# downgrading an auth failure into a generic ValueError.
_TRANSLATED_STATUS_CODES = frozenset({400, 404, 409, 422})


def map_domain_errors[**P, R](func: Callable[P, R]) -> Callable[P, R]:
    """Translate expected-failure HTTPExceptions raised by ``func`` into ValueError."""

    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return func(*args, **kwargs)
        except HTTPException as exc:
            if exc.status_code in _TRANSLATED_STATUS_CODES:
                raise ValueError(str(exc.detail)) from exc
            raise

    return wrapper
