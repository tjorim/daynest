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
import logging
import secrets
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

from fastapi import HTTPException
from fastmcp.exceptions import ToolError
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

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


def describe_validation_error(exc: ValidationError) -> str:
    """Summarise a Pydantic failure as ``field: message`` pairs, never echoing input or context values."""
    return "; ".join(
        f"{'.'.join(str(part) for part in error['loc']) or 'input'}: {error['msg']}"
        for error in exc.errors(include_input=False, include_url=False, include_context=False)
    )


def validate_arguments[M: BaseModel](model: type[M], payload: Mapping[str, Any]) -> M:
    """Validate tool arguments against ``model`` and report failures without echoing the caller's values.

    Pydantic's default message (and the exception chained to it) carries the
    offending ``input_value``, which FastMCP logs and returns to the client.
    """
    try:
        return model.model_validate(payload)
    except ValidationError as exc:
        raise ValueError(f"Invalid arguments: {describe_validation_error(exc)}") from None


def guard_invalid_results[**P, R](tool_name: str, func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    """Report a ``ValidationError`` escaping a tool body as an invalid stored/generated result.

    Argument failures are already turned into ``ValueError`` by ``validate_arguments``,
    so a Pydantic error that still reaches the tool boundary came from building a
    response or reading stored data. The client gets a correlation reference and the
    log gets field paths and error types only; both would otherwise carry raw values.
    """

    @functools.wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return await func(*args, **kwargs)
        except ValidationError as exc:
            reference = secrets.token_hex(6)
            logger.error(
                "MCP tool %s produced an invalid result (ref=%s, errors=%s)",
                tool_name,
                reference,
                [(".".join(str(part) for part in e["loc"]), e["type"]) for e in exc.errors(include_input=False)],
            )
            raise ToolError(
                f"{tool_name} could not return a valid result for the stored data (reference {reference})."
            ) from None

    return wrapper
