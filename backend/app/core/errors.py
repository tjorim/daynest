"""API errors that carry a stable machine-readable code.

``detail`` stays the English diagnostic string every client already receives.
``code`` (and the optional ``params``) let a client show its own translation
instead of echoing ``detail`` to the user.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping
from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"
INTERNAL_ERROR_DETAIL = "Internal server error"
INTERNAL_ERROR_CODE = "internal_error"


class ApiException(HTTPException):
    """``HTTPException`` with a stable ``code`` and safe, user-displayable ``params``."""

    def __init__(
        self,
        status_code: int,
        code: str,
        detail: str | None = None,
        *,
        params: Mapping[str, str | int | float | bool] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=dict(headers) if headers else None)
        self.code = code
        self.params = dict(params) if params else None


async def handle_api_exception(request: Request, exc: Exception) -> Response:
    """Render an ``ApiException`` as ``{"detail", "code", "params"?}``."""
    if not isinstance(exc, ApiException):
        raise exc
    payload: dict[str, Any] = {"detail": exc.detail, "code": exc.code}
    if exc.params:
        payload["params"] = exc.params
    return JSONResponse(payload, status_code=exc.status_code, headers=exc.headers)


def internal_error_response() -> JSONResponse:
    """The body of every unhandled exception: ``{"detail": "Internal server error", "code": "internal_error"}``.

    Never carries the exception, its message or a stack trace; those stay in the server log and in Sentry.
    """
    return JSONResponse({"detail": INTERNAL_ERROR_DETAIL, "code": INTERNAL_ERROR_CODE}, status_code=500)


async def handle_unhandled_exception(request: Request, exc: Exception) -> Response:
    """Answer an exception no other handler took, for the paths that bypass ``observability_middleware``.

    ``observability_middleware`` already answers exceptions raised below it (and logs, counts and reports them).
    An exception raised outside it reaches Starlette's outermost ``ServerErrorMiddleware``, which calls this handler
    and then re-raises for the server; the response still carries the request id, taken from ``request.state`` when
    the middleware got that far, else a fresh one.
    """
    logger.error(
        "Unhandled error outside the request middleware: %s %s", request.method, request.url.path, exc_info=exc
    )
    response = internal_error_response()
    response.headers[REQUEST_ID_HEADER] = getattr(request.state, "request_id", None) or str(uuid.uuid4())
    return response
