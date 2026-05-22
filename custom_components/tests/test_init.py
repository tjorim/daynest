"""Unit tests for custom_components.daynest.__init__."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import custom_components.daynest as integration
from custom_components.daynest.const import (
    AUTH_MODE_CLIENT_CREDENTIALS,
    AUTH_MODE_OAUTH_REDIRECT,
    CONF_AUTH_MODE,
    CONF_AUTHORIZATION_URL,
    CONF_TOKEN_URL,
    build_oidc_authorization_url,
    build_oidc_token_url,
    build_token_url,
)
from homeassistant.const import CONF_API_KEY, CONF_CLIENT_ID, CONF_CLIENT_SECRET, CONF_URL


class _ResourceCollection:
    """Minimal Lovelace resource collection fake."""

    def __init__(self, items: list[dict] | None = None) -> None:
        self.items = items or []
        self.async_get_info = AsyncMock(return_value={"resources": len(self.items)})
        self.async_create_item = AsyncMock(side_effect=self._create_item)
        self.async_update_item = AsyncMock(side_effect=self._update_item)

    def async_items(self) -> list[dict]:
        return self.items

    async def _create_item(self, data: dict) -> dict:
        item = {"id": "resource-id", "type": data["res_type"], "url": data["url"]}
        self.items.append(item)
        return item

    async def _update_item(self, item_id: str, updates: dict) -> dict:
        for item in self.items:
            if item["id"] == item_id:
                item.update({"type": updates["res_type"], "url": updates["url"]})
                return item
        raise KeyError(item_id)


@pytest.mark.unit
class TestMigrateEntry:
    async def test_migrates_v1_entry_to_daynest_token_endpoint(self) -> None:
        hass = MagicMock()
        hass.config_entries.async_update_entry = MagicMock()
        entry = MagicMock(
            version=1,
            data={
                CONF_URL: "https://api.daynest.example/",
                CONF_API_KEY: "daynest_legacy_key",
            },
        )

        migrated = await integration.async_migrate_entry(hass, entry)

        assert migrated is True
        first_call_kwargs = hass.config_entries.async_update_entry.call_args_list[0][1]
        assert first_call_kwargs["version"] == 4
        assert first_call_kwargs["data"][CONF_URL] == "https://api.daynest.example"
        assert first_call_kwargs["data"][CONF_CLIENT_ID] == "home-assistant"
        assert first_call_kwargs["data"][CONF_CLIENT_SECRET] == "daynest_legacy_key"
        assert first_call_kwargs["data"][CONF_TOKEN_URL] == build_token_url("https://api.daynest.example")
        assert first_call_kwargs["data"][CONF_AUTH_MODE] == AUTH_MODE_CLIENT_CREDENTIALS

    async def test_migrates_v2_keycloak_token_url_to_daynest_token_endpoint(self) -> None:
        hass = MagicMock()
        hass.config_entries.async_update_entry = MagicMock()
        entry = MagicMock(
            version=2,
            data={
                CONF_URL: "https://api.daynest.example",
                CONF_CLIENT_ID: "home-assistant",
                CONF_CLIENT_SECRET: "daynest_secret",
                CONF_TOKEN_URL: "https://api.daynest.example/realms/daynest/protocol/openid-connect/token",
            },
        )

        migrated = await integration.async_migrate_entry(hass, entry)

        assert migrated is True
        first_call_kwargs = hass.config_entries.async_update_entry.call_args_list[0][1]
        assert first_call_kwargs["version"] == 4
        assert first_call_kwargs["data"][CONF_TOKEN_URL] == build_token_url("https://api.daynest.example")
        assert first_call_kwargs["data"][CONF_AUTH_MODE] == AUTH_MODE_CLIENT_CREDENTIALS

    async def test_migrates_v3_oauth_redirect_entry_to_v4(self) -> None:
        hass = MagicMock()
        hass.config_entries.async_update_entry = MagicMock()
        entry = MagicMock(
            version=3,
            data={
                CONF_URL: "https://api.daynest.example",
                "token": {"access_token": "token", "expires_at": 9999999999},
                "auth_implementation": "daynest",
            },
        )

        migrated = await integration.async_migrate_entry(hass, entry)

        assert migrated is True
        first_call_kwargs = hass.config_entries.async_update_entry.call_args_list[0][1]
        assert first_call_kwargs["version"] == 4
        assert first_call_kwargs["data"][CONF_AUTH_MODE] == AUTH_MODE_OAUTH_REDIRECT
        assert first_call_kwargs["data"][CONF_AUTHORIZATION_URL] == build_oidc_authorization_url("https://api.daynest.example")
        assert first_call_kwargs["data"][CONF_TOKEN_URL] == build_oidc_token_url("https://api.daynest.example")

    async def test_migrates_v4_client_credentials_normalizes_token_url(self) -> None:
        hass = MagicMock()
        hass.config_entries.async_update_entry = MagicMock()
        entry = MagicMock(
            version=4,
            data={
                CONF_URL: "https://api.daynest.example",
                CONF_CLIENT_ID: "home-assistant",
                CONF_CLIENT_SECRET: "daynest_secret",
                CONF_TOKEN_URL: "https://api.daynest.example/realms/daynest/protocol/openid-connect/token",
            },
        )

        migrated = await integration.async_migrate_entry(hass, entry)

        assert migrated is True
        _, kwargs = hass.config_entries.async_update_entry.call_args
        assert kwargs["version"] == 5
        assert kwargs["data"][CONF_TOKEN_URL] == build_token_url("https://api.daynest.example")
        assert kwargs["data"][CONF_AUTH_MODE] == AUTH_MODE_CLIENT_CREDENTIALS

    async def test_migrates_v4_oauth_redirect_sets_missing_urls(self) -> None:
        hass = MagicMock()
        hass.config_entries.async_update_entry = MagicMock()
        entry = MagicMock(
            version=4,
            data={
                CONF_URL: "https://api.daynest.example",
                "token": {"access_token": "token", "expires_at": 9999999999},
                "auth_implementation": "daynest",
            },
        )

        migrated = await integration.async_migrate_entry(hass, entry)

        assert migrated is True
        _, kwargs = hass.config_entries.async_update_entry.call_args
        assert kwargs["version"] == 5
        assert kwargs["data"][CONF_AUTH_MODE] == AUTH_MODE_OAUTH_REDIRECT
        assert kwargs["data"][CONF_AUTHORIZATION_URL] == build_oidc_authorization_url("https://api.daynest.example")
        assert kwargs["data"][CONF_TOKEN_URL] == build_oidc_token_url("https://api.daynest.example")


@pytest.mark.unit
class TestSetupEntry:
    async def test_setup_entry_client_credentials_uses_token_url_from_entry(self) -> None:
        hass = MagicMock()
        hass.config_entries.async_update_entry = MagicMock()
        hass.config_entries.async_forward_entry_setups = AsyncMock()
        hass.services.has_service.return_value = True
        hass.data = {}

        token_url = build_token_url("https://api.daynest.example")
        entry = MagicMock(
            data={
                CONF_URL: "https://api.daynest.example",
                CONF_CLIENT_ID: "home-assistant",
                CONF_CLIENT_SECRET: "daynest_secret",
                CONF_TOKEN_URL: token_url,
                CONF_AUTH_MODE: AUTH_MODE_CLIENT_CREDENTIALS,
            },
            domain="daynest",
            add_update_listener=MagicMock(return_value=MagicMock()),
            async_on_unload=MagicMock(),
        )

        coordinator = MagicMock()
        coordinator.async_config_entry_first_refresh = AsyncMock()
        coordinator.async_start_sse = AsyncMock()

        with (
            patch("custom_components.daynest.async_get_clientsession", return_value=MagicMock()),
            patch("custom_components.daynest.DaynestClient") as client_cls,
            patch("custom_components.daynest.DaynestDataUpdateCoordinator", return_value=coordinator),
            patch("custom_components.daynest.async_get_loaded_integration", return_value=MagicMock(version="1.0.0")),
            patch("custom_components.daynest.async_setup_services", new=AsyncMock()),
            patch("custom_components.daynest.async_register_static_paths", new=AsyncMock()),
            patch("custom_components.daynest.add_extra_js_url"),
            patch("pathlib.Path.exists", return_value=False),
        ):
            loaded = await integration.async_setup_entry(hass, entry)

        assert loaded is True
        _, kwargs = client_cls.call_args
        assert kwargs["token_url"] == token_url
        hass.config_entries.async_update_entry.assert_not_called()

    async def test_setup_entry_with_oauth_redirect_uses_oauth2_session_token(self) -> None:
        hass = MagicMock()
        hass.config_entries.async_update_entry = MagicMock()
        hass.config_entries.async_forward_entry_setups = AsyncMock()
        hass.services.has_service.return_value = True
        hass.data = {}

        entry = MagicMock(
            data={
                CONF_URL: "https://api.daynest.example",
                CONF_AUTH_MODE: AUTH_MODE_OAUTH_REDIRECT,
                CONF_AUTHORIZATION_URL: build_oidc_authorization_url("https://api.daynest.example"),
                CONF_TOKEN_URL: build_oidc_token_url("https://api.daynest.example"),
                "token": {"access_token": "oidc_access_token", "expires_at": 9999999999},
                "auth_implementation": "daynest",
            },
            domain="daynest",
            add_update_listener=MagicMock(return_value=MagicMock()),
            async_on_unload=MagicMock(),
        )

        coordinator = MagicMock()
        coordinator.async_config_entry_first_refresh = AsyncMock()
        coordinator.async_start_sse = AsyncMock()

        oauth_session = MagicMock()
        oauth_session.async_ensure_token_valid = AsyncMock()
        oauth_session.token = {"access_token": "oidc_access_token", "expires_at": 9999999999}

        with (
            patch("custom_components.daynest.async_get_clientsession", return_value=MagicMock()),
            patch("custom_components.daynest.DaynestClient") as client_cls,
            patch("custom_components.daynest.DaynestDataUpdateCoordinator", return_value=coordinator),
            patch("custom_components.daynest.async_get_loaded_integration", return_value=MagicMock(version="1.0.0")),
            patch("custom_components.daynest.async_setup_services", new=AsyncMock()),
            patch("custom_components.daynest.async_register_static_paths", new=AsyncMock()),
            patch("custom_components.daynest.add_extra_js_url"),
            patch("custom_components.daynest.config_entry_oauth2_flow.OAuth2Session", return_value=oauth_session),
            patch("pathlib.Path.exists", return_value=False),
        ):
            loaded = await integration.async_setup_entry(hass, entry)

        assert loaded is True
        _, kwargs = client_cls.call_args
        access_token_getter = kwargs["access_token_getter"]
        assert await access_token_getter() == "oidc_access_token"
        oauth_session.async_ensure_token_valid.assert_awaited()


@pytest.mark.unit
class TestLovelaceResource:
    async def test_registers_daynest_card_resource(self) -> None:
        resources = _ResourceCollection()
        hass = MagicMock()
        hass.data = {
            "lovelace": MagicMock(
                resources=resources,
            )
        }

        with patch("custom_components.daynest.ResourceStorageCollection", _ResourceCollection):
            await integration._async_register_lovelace_resource(
                hass,
                "/daynest/static/daynest-card.js?v=1.0.0",
            )

        resources.async_create_item.assert_awaited_once_with(
            {
                "res_type": "module",
                CONF_URL: "/daynest/static/daynest-card.js?v=1.0.0",
            }
        )

    async def test_updates_existing_daynest_card_resource(self) -> None:
        resources = _ResourceCollection(
            [{"id": "resource-id", "type": "module", "url": "/daynest/static/daynest-card.js?v=0.1.0"}]
        )
        hass = MagicMock()
        hass.data = {
            "lovelace": MagicMock(
                resources=resources,
            )
        }

        with patch("custom_components.daynest.ResourceStorageCollection", _ResourceCollection):
            await integration._async_register_lovelace_resource(
                hass,
                "/daynest/static/daynest-card.js?v=1.0.0",
            )

        resources.async_create_item.assert_not_awaited()
        resources.async_update_item.assert_awaited_once_with(
            "resource-id",
            {
                "res_type": "module",
                CONF_URL: "/daynest/static/daynest-card.js?v=1.0.0",
            },
        )
