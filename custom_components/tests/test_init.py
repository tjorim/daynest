"""Unit tests for custom_components.daynest.__init__."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import custom_components.daynest as integration
from custom_components.daynest.const import CONF_TOKEN_URL, build_token_url
from homeassistant.const import CONF_API_KEY, CONF_CLIENT_ID, CONF_CLIENT_SECRET, CONF_URL


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
        _, kwargs = hass.config_entries.async_update_entry.call_args
        assert kwargs["version"] == 3
        assert kwargs["data"][CONF_URL] == "https://api.daynest.example"
        assert kwargs["data"][CONF_CLIENT_ID] == "home-assistant"
        assert kwargs["data"][CONF_CLIENT_SECRET] == "daynest_legacy_key"
        assert kwargs["data"][CONF_TOKEN_URL] == build_token_url("https://api.daynest.example")

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
        _, kwargs = hass.config_entries.async_update_entry.call_args
        assert kwargs["version"] == 3
        assert kwargs["data"][CONF_TOKEN_URL] == build_token_url("https://api.daynest.example")


@pytest.mark.unit
class TestSetupEntry:
    async def test_setup_entry_normalizes_legacy_token_url(self) -> None:
        hass = MagicMock()
        hass.config_entries.async_update_entry = MagicMock()
        hass.config_entries.async_forward_entry_setups = AsyncMock()
        hass.services.has_service.return_value = True
        hass.data = {}

        entry = MagicMock(
            data={
                CONF_URL: "https://api.daynest.example",
                CONF_CLIENT_ID: "home-assistant",
                CONF_CLIENT_SECRET: "daynest_secret",
                CONF_TOKEN_URL: "https://api.daynest.example/realms/daynest/protocol/openid-connect/token",
            },
            domain="daynest",
            add_update_listener=MagicMock(return_value=MagicMock()),
            async_on_unload=MagicMock(),
        )

        coordinator = MagicMock()
        coordinator.async_config_entry_first_refresh = AsyncMock()

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
        assert kwargs["token_url"] == build_token_url("https://api.daynest.example")
        _, update_kwargs = hass.config_entries.async_update_entry.call_args
        assert update_kwargs["data"][CONF_TOKEN_URL] == build_token_url("https://api.daynest.example")
