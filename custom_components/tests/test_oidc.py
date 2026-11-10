"""Tests for validated sign-in configuration discovery."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import aiohttp
import pytest

from custom_components.daynest.oidc import (
    HA_OIDC_CONFIG_PATH,
    LEGACY_OIDC_CONFIG_PATH,
    async_fetch_oidc_config,
    validated_oidc_config,
)

AUTH = "https://auth.example.test/realms/daynest/protocol/openid-connect/auth"
TOKEN = "https://auth.example.test/realms/daynest/protocol/openid-connect/token"
CONFIG = {"authorization_url": AUTH, "token_url": TOKEN, "client_id": "home-assistant"}


def _session(*responses: tuple[int, object] | Exception) -> MagicMock:
    """Session whose successive GETs return (status, json) or raise."""
    calls = iter(responses)
    session = MagicMock()

    def get(url: str, **kwargs: object) -> MagicMock:
        session.requested.append((url, kwargs))
        outcome = next(calls)
        context = MagicMock()
        if isinstance(outcome, Exception):
            context.__aenter__ = AsyncMock(side_effect=outcome)
        else:
            response = MagicMock(status=outcome[0])
            response.json = AsyncMock(return_value=outcome[1])
            context.__aenter__ = AsyncMock(return_value=response)
        context.__aexit__ = AsyncMock(return_value=False)
        return context

    session.requested = []
    session.get = get
    return session


class TestValidatedConfig:
    def test_accepts_https_same_host(self) -> None:
        assert validated_oidc_config(CONFIG) == (AUTH, TOKEN, "home-assistant")

    def test_default_client_used_when_endpoint_omits_it(self) -> None:
        without_client = {"authorization_url": AUTH, "token_url": TOKEN}
        assert validated_oidc_config(without_client, default_client_id="home-assistant")[2] == "home-assistant"
        with pytest.raises(ValueError, match="client"):
            validated_oidc_config(without_client)

    def test_loopback_http_allowed_for_local_development(self) -> None:
        local = {"authorization_url": "http://localhost:8080/auth", "token_url": "http://localhost:8080/token"}
        assert validated_oidc_config(local, default_client_id="c")[0] == "http://localhost:8080/auth"

    @pytest.mark.parametrize(
        "override",
        [
            {"authorization_url": "http://auth.example.test/auth"},
            {"authorization_url": "https://user:pw@auth.example.test/auth"},
            {"authorization_url": "https://auth.example.test/auth?next=https://evil.test"},
            {"authorization_url": "javascript:alert(1)"},
            {"token_url": "https://evil.example.test/token"},
            {"client_id": " "},
        ],
    )
    def test_rejects_unsafe_values(self, override: dict[str, str]) -> None:
        with pytest.raises(ValueError):
            validated_oidc_config({**CONFIG, **override})

    @pytest.mark.parametrize("bad", [None, ["x"], "text", {"authorization_url": None, "token_url": TOKEN}])
    def test_rejects_wrong_types(self, bad: object) -> None:
        with pytest.raises(TypeError):
            validated_oidc_config(bad)


class TestFetch:
    async def test_prefers_ha_endpoint_and_never_follows_redirects(self) -> None:
        session = _session((200, CONFIG))
        assert await async_fetch_oidc_config(session, "https://api.daynest.example/") == (AUTH, TOKEN, "home-assistant")
        url, kwargs = session.requested[0]
        assert url == f"https://api.daynest.example{HA_OIDC_CONFIG_PATH}"
        assert kwargs["allow_redirects"] is False

    async def test_older_backend_falls_back_to_generic_endpoint_and_default_client(self) -> None:
        generic = {"authorization_url": AUTH, "token_url": TOKEN, "issuer": "https://auth.example.test/realms/daynest"}
        session = _session((404, {}), (200, generic))
        assert await async_fetch_oidc_config(session, "https://api.daynest.example") == (AUTH, TOKEN, "home-assistant")
        assert session.requested[1][0] == f"https://api.daynest.example{LEGACY_OIDC_CONFIG_PATH}"

    @pytest.mark.parametrize(
        "outcome",
        [
            (302, {}),
            (503, {}),
            (200, {**CONFIG, "authorization_url": "http://insecure.example.test/auth"}),
            (200, {**CONFIG, "token_url": "https://evil.example.test/token"}),
            (200, "not an object"),
            aiohttp.ClientConnectionError(),
            TimeoutError(),
        ],
    )
    async def test_returns_none_for_unusable_responses(self, outcome: tuple[int, object] | Exception) -> None:
        assert await async_fetch_oidc_config(_session(outcome), "https://api.daynest.example") is None
