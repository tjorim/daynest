"""API errors that carry a stable machine-readable code.

``detail`` stays the English diagnostic string every client already receives.
``code`` (and the optional ``params``) let a client show its own translation
instead of echoing ``detail`` to the user.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, Response


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
