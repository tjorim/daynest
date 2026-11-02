"""Per-client-IP REST limits, enforced after FastAPI has resolved the route."""

import ipaddress
import math
import re
import time

from limits import parse_many
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import compile_path

from app.core.config import settings


def _peer_is_trusted_proxy(request: Request) -> bool:
    """Whether the immediate TCP peer looks like an internal reverse proxy.

    ``daynest-api`` is only ``expose``d (not published) on the shared infra
    Docker network today, so Caddy should be the only thing that can ever
    connect directly — but that's a network-topology assumption, not
    something this process can verify on its own. Require the peer to be on
    a private address before trusting a client-supplied ``X-Real-IP``
    header, so a request landing here some other way (a network
    misconfiguration, or a peer sharing the same Docker network) can't set
    an arbitrary key and get a fresh rate-limit bucket on every request.
    """
    if not request.client or not request.client.host:
        return False
    try:
        return ipaddress.ip_address(request.client.host).is_private
    except ValueError:
        return False


def get_client_ip(request: Request) -> str:
    """Return the client IP, preferring the ``X-Real-IP`` header set by Caddy.

    slowapi's built-in key functions read either ``request.client.host`` (the
    reverse proxy's own address behind Caddy, which would bucket every real
    client together) or a malformed ``X-Forwarded-For`` lookup. Caddy already
    resolves the true client IP (trusting Cloudflare's edge) and forwards it
    via ``X-Real-IP``, so prefer that — but only when the request actually
    came from a trusted internal peer; a header from anyone else is
    caller-controlled and must not be trusted for rate-limit bucketing.
    """
    real_ip = request.headers.get("x-real-ip")
    if real_ip and _peer_is_trusted_proxy(request):
        return real_ip
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


class RateLimitExceeded(Exception):
    def __init__(self, detail: str, headers: dict[str, str]) -> None:
        self.detail = detail
        self.headers = headers


class RequestRateLimiter:
    """Process-local fixed windows, matching the former slowapi defaults.

    Keys use client IP and route template, shared across methods and path IDs.
    Mounted ASGI apps do not run FastAPI dependencies and own their limits.
    """

    def __init__(self, limit: str, *, enabled: bool = True) -> None:
        self.enabled = enabled
        self.limits = parse_many(limit)
        self.strategy = FixedWindowRateLimiter(MemoryStorage())

    def check(self, request: Request, response: Response) -> None:
        if not self.enabled:
            return
        template = route_template(request)
        if template in exempt_paths():
            return
        identifiers = (get_client_ip(request), template)
        for item in self.limits:
            allowed = self.strategy.hit(item, *identifiers)
            reset, remaining = self.strategy.get_window_stats(item, *identifiers)
            headers = {
                "X-RateLimit-Limit": str(item.amount),
                "X-RateLimit-Remaining": str(remaining),
                "X-RateLimit-Reset": str(reset + 1),
                "Retry-After": str(max(1, math.ceil(reset - time.time()))),
            }
            if not allowed:
                raise RateLimitExceeded(str(item), headers)
            response.headers.update(headers)


def route_template(request: Request) -> str:
    """Keep inclusion prefixes when FastAPI exposes the router-local route.

    Match only the already selected route's suffix; no route-tree traversal or
    FastAPI effective-route internals are needed. Captured parameter values never
    become bucket keys.
    """
    route = request.scope.get("route")
    path = request.url.path
    local_path = getattr(route, "path", None)
    if local_path is None:
        return path
    regex, template, _ = compile_path(local_path)
    match = re.search(regex.pattern.removeprefix("^"), path)
    if match is None:
        raise RuntimeError("Selected route does not match the request path")
    return path[: match.start()] + template


def exempt_paths() -> frozenset[str]:
    return frozenset(f"{settings.api_prefix}/health/{probe}" for probe in ("liveness", "readiness"))


limiter = RequestRateLimiter(settings.rate_limit_default, enabled=settings.rate_limit_enabled)


async def rate_limit(request: Request, response: Response) -> None:
    """Global dependency: included routers run this before auth and route handlers."""
    request.app.state.limiter.check(request, response)


def handle_rate_limit_exceeded(request: Request, exc: Exception) -> Response:
    if not isinstance(exc, RateLimitExceeded):
        raise exc
    return JSONResponse({"error": f"Rate limit exceeded: {exc.detail}"}, status_code=429, headers=exc.headers)
