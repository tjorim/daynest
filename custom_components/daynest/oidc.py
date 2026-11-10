"""Sign-in endpoints advertised by the Daynest origin, validated before use."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit

import aiohttp

from .const import DEFAULT_OIDC_CLIENT_ID, LOGGER

HA_OIDC_CONFIG_PATH = "/api/integrations/home-assistant/oidc-config"
LEGACY_OIDC_CONFIG_PATH = "/api/auth/oidc-config"
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=15)
LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def _checked_url(value: object) -> str:
    """Accept only plain HTTPS URLs (HTTP only on loopback for local development)."""
    if not isinstance(value, str):
        msg = "Sign-in endpoints must be URLs"
        raise TypeError(msg)
    url = urlsplit(value)
    insecure = url.scheme == "http" and url.hostname not in LOOPBACK_HOSTS
    if (
        url.scheme not in {"https", "http"}
        or insecure
        or not url.hostname
        or url.username
        or url.password
        or url.query
        or url.fragment
    ):
        msg = "Sign-in endpoints must be plain HTTPS URLs"
        raise ValueError(msg)
    return value


def validated_oidc_config(config: object, *, default_client_id: str | None = None) -> tuple[str, str, str]:
    """Return (authorization_url, token_url, client_id) or raise ValueError/TypeError.

    Both endpoints must be HTTPS and on one host, so a token request can never
    go to a different server than the sign-in page.
    """
    if not isinstance(config, Mapping):
        msg = "Sign-in configuration must be an object"
        raise TypeError(msg)
    authorization_url = _checked_url(config.get("authorization_url"))
    token_url = _checked_url(config.get("token_url"))
    if urlsplit(authorization_url).netloc.lower() != urlsplit(token_url).netloc.lower():
        msg = "Sign-in endpoints must share one host"
        raise ValueError(msg)
    client_id = config.get("client_id", default_client_id)
    if not isinstance(client_id, str) or not client_id.strip():
        msg = "Missing client ID"
        raise ValueError(msg)
    return authorization_url, token_url, client_id.strip()


async def async_fetch_oidc_config(session: aiohttp.ClientSession, base_url: str) -> tuple[str, str, str] | None:
    """Read validated sign-in configuration from the Daynest backend, or None.

    Prefers the Home Assistant endpoint, which also names the client; an older
    backend without it falls back to the generic endpoint and the default
    client. Redirects are never followed.
    """
    origin = base_url.strip().rstrip("/")
    for path, default_client_id in ((HA_OIDC_CONFIG_PATH, None), (LEGACY_OIDC_CONFIG_PATH, DEFAULT_OIDC_CLIENT_ID)):
        try:
            async with session.get(f"{origin}{path}", timeout=REQUEST_TIMEOUT, allow_redirects=False) as response:
                if response.status == 404 and default_client_id is None:
                    continue
                if response.status != 200:
                    return None
                payload: Any = await response.json(content_type=None)
            return validated_oidc_config(payload, default_client_id=default_client_id)
        except aiohttp.ClientError, TimeoutError, TypeError, ValueError:
            LOGGER.debug("Failed to read Daynest sign-in configuration from %s%s", origin, path, exc_info=True)
            return None
    return None
