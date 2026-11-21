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

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

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


_STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
}


def default_error_code(status_code: int) -> str:
    """The stable ``code`` for an HTTP error that carries none of its own (``http_<status>`` when not listed)."""
    return _STATUS_CODES.get(status_code, f"http_{status_code}")


async def handle_http_exception(request: Request, exc: Exception) -> Response:
    """Render a framework or dependency ``HTTPException`` with its ``detail`` unchanged and a ``code`` added.

    Replaces FastAPI's default handler (unknown route, wrong method, a bare ``HTTPException``). A ``code`` or
    ``params`` the exception already carries (``ApiException``) is kept, and its headers (``WWW-Authenticate``,
    ``Retry-After``, ``Allow``) are passed on.
    """
    if not isinstance(exc, StarletteHTTPException):
        raise exc
    headers = getattr(exc, "headers", None)
    if exc.status_code < 200 or exc.status_code in (204, 304):
        return Response(status_code=exc.status_code, headers=headers)
    payload: dict[str, Any] = {
        "detail": exc.detail,
        "code": getattr(exc, "code", None) or default_error_code(exc.status_code),
    }
    params = getattr(exc, "params", None)
    if params:
        payload["params"] = params
    return JSONResponse(payload, status_code=exc.status_code, headers=headers)


VALIDATION_ERROR_CODE = "validation_error"

# ``input`` (the submitted value) and ``ctx`` (constraint values, sometimes the raw cause) can echo secrets or PII.
_UNSAFE_VALIDATION_KEYS = frozenset({"input", "ctx"})


async def handle_validation_error(request: Request, exc: Exception) -> Response:
    """Render a 422 as FastAPI's ``detail`` list (``type``, ``loc``, ``msg``) without the submitted values.

    ``detail`` stays a list, as the generated client and the frontend read it; ``code`` is added next to it.
    """
    if not isinstance(exc, RequestValidationError):
        raise exc
    detail = [
        {key: value for key, value in issue.items() if key not in _UNSAFE_VALIDATION_KEYS} for issue in exc.errors()
    ]
    return JSONResponse(
        {"detail": detail, "code": VALIDATION_ERROR_CODE}, status_code=status.HTTP_422_UNPROCESSABLE_CONTENT
    )
