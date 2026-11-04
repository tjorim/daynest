"""Per-client-IP REST limits after routing; mounts retain their own policy."""

from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.request_limits import RateLimitExceeded, RequestRateLimiter, get_client_ip, route_template

__all__ = [
    "RateLimitExceeded",
    "RequestRateLimiter",
    "exempt_paths",
    "get_client_ip",
    "handle_rate_limit_exceeded",
    "rate_limit",
]


def exempt_paths() -> frozenset[str]:
    return frozenset(f"{settings.api_prefix}/health/{probe}" for probe in ("liveness", "readiness"))


limiter = RequestRateLimiter(settings.rate_limit_default, enabled=settings.rate_limit_enabled)


async def rate_limit(request: Request) -> None:
    if route_template(request) not in exempt_paths():
        request.app.state.limiter.check(request)


def handle_rate_limit_exceeded(request: Request, exc: Exception) -> Response:
    if not isinstance(exc, RateLimitExceeded):
        raise exc
    return JSONResponse(
        {"error": f"Rate limit exceeded: {exc.detail}"},
        status_code=429,
        headers={**exc.rate_headers, "Cache-Control": "no-store"},
    )
