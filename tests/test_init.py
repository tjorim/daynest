"""Unit tests for Daynest integration setup/unload."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.daynest import CARD_URL, DOMAIN, async_setup_entry, async_unload_entry
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import CONF_API_KEY, CONF_URL


def _make_hass() -> MagicMock:
    hass = MagicMock()
    hass.data = {}
    hass.services.has_service = MagicMock(return_value=False)
    hass.config_entries.async_forward_entry_setups = AsyncMock()
    hass.config_entries.async_unload_platforms = AsyncMock(return_value=True)
    hass.config_entries.async_entries = MagicMock(return_value=[])
    return hass


def _make_entry(entry_id: str = "entry-1") -> MagicMock:
    entry = MagicMock()
    entry.data = {
        CONF_URL: "http://localhost:8000",
        CONF_API_KEY: "api-key",
    }
    entry.domain = DOMAIN
    entry.entry_id = entry_id
    entry.add_update_listener = MagicMock(return_value=MagicMock())
    entry.async_on_unload = MagicMock()
    return entry


@pytest.mark.unit
@pytest.mark.asyncio
class TestInitSetup:
    """Tests for integration setup and unload behavior."""

    async def test_setup_entry_warns_and_skips_card_when_build_missing(self) -> None:
        hass = _make_hass()
        entry = _make_entry()
        coordinator = MagicMock()
        coordinator.async_config_entry_first_refresh = AsyncMock()

        with (
            patch("custom_components.daynest.DaynestClient"),
            patch("custom_components.daynest.async_get_clientsession"),
            patch("custom_components.daynest.DaynestDataUpdateCoordinator", return_value=coordinator),
            patch("custom_components.daynest.async_get_loaded_integration", return_value=MagicMock()),
            patch("custom_components.daynest.async_setup_services", new=AsyncMock()),
            patch("custom_components.daynest.Path.exists", return_value=False),
            patch("custom_components.daynest.LOGGER") as mock_logger,
            patch("custom_components.daynest.async_register_static_paths", new=AsyncMock()) as mock_register,
            patch("custom_components.daynest.add_extra_js_url") as mock_add_js,
        ):
            assert await async_setup_entry(hass, entry) is True

        mock_logger.warning.assert_called_once_with(
            "daynest-card.js not found; dashboard card will not be available"
        )
        mock_register.assert_not_awaited()
        mock_add_js.assert_not_called()
        assert not hass.data[DOMAIN].get("card_registered", False)

    async def test_setup_entry_registers_card_when_build_exists(self) -> None:
        hass = _make_hass()
        entry = _make_entry()
        coordinator = MagicMock()
        coordinator.async_config_entry_first_refresh = AsyncMock()

        mock_integration = MagicMock()
        mock_integration.version = "1.0.0"
        with (
            patch("custom_components.daynest.DaynestClient"),
            patch("custom_components.daynest.async_get_clientsession"),
            patch("custom_components.daynest.DaynestDataUpdateCoordinator", return_value=coordinator),
            patch("custom_components.daynest.async_get_loaded_integration", return_value=mock_integration),
            patch("custom_components.daynest.async_setup_services", new=AsyncMock()),
            patch("custom_components.daynest.Path.exists", return_value=True),
            patch("custom_components.daynest.async_register_static_paths", new=AsyncMock()) as mock_register,
            patch("custom_components.daynest.add_extra_js_url") as mock_add_js,
        ):
            assert await async_setup_entry(hass, entry) is True

        mock_register.assert_awaited_once()
        static_path = mock_register.await_args.args[1][0]
        assert static_path.url_path == CARD_URL
        assert static_path.path.endswith("daynest-card.js")
        assert static_path.cache_headers is True
        mock_add_js.assert_called_once_with(hass, f"{CARD_URL}?v=1.0.0")
        assert hass.data[DOMAIN]["card_registered"] is True
        assert hass.data[DOMAIN]["versioned_url"] == f"{CARD_URL}?v=1.0.0"

    async def test_unload_entry_removes_injected_card_when_last_entry(self) -> None:
        versioned_url = f"{CARD_URL}?v=1.0.0"
        hass = _make_hass()
        hass.data = {DOMAIN: {"card_registered": True, "versioned_url": versioned_url}}
        entry = _make_entry()
        hass.config_entries.async_entries.return_value = []

        with (
            patch("custom_components.daynest.async_unload_services"),
            patch("custom_components.daynest.remove_extra_js_url") as mock_remove_js,
        ):
            assert await async_unload_entry(hass, entry) is True

        mock_remove_js.assert_called_once_with(hass, versioned_url)
        assert hass.data[DOMAIN]["card_registered"] is False

    async def test_unload_entry_keeps_injected_card_when_another_entry_loaded(self) -> None:
        hass = _make_hass()
        hass.data = {DOMAIN: {"card_registered": True}}
        entry = _make_entry()
        loaded_entry = _make_entry("entry-2")
        loaded_entry.state = ConfigEntryState.LOADED
        hass.config_entries.async_entries.return_value = [loaded_entry]

        with (
            patch("custom_components.daynest.async_unload_services"),
            patch("custom_components.daynest.remove_extra_js_url") as mock_remove_js,
        ):
            assert await async_unload_entry(hass, entry) is True

        mock_remove_js.assert_not_called()
        assert hass.data[DOMAIN]["card_registered"] is True
