"""Set up the Daynest Home Assistant integration."""

from __future__ import annotations

from typing import TYPE_CHECKING

import homeassistant.helpers.config_validation as cv
from homeassistant.const import CONF_API_KEY, CONF_URL, Platform
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_loaded_integration

from .api import DaynestApiClient
from .const import DOMAIN
from .coordinator import DaynestDataUpdateCoordinator
from .data import DaynestData
from .services import async_setup_services, async_unload_services

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import DaynestConfigEntry

PLATFORMS: list[Platform] = [Platform.SENSOR]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Daynest domain."""
    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
) -> bool:
    """Set up Daynest from a config entry."""
    client = DaynestApiClient(
        base_url=entry.data[CONF_URL],
        integration_key=entry.data[CONF_API_KEY],
        session=async_get_clientsession(hass),
    )

    coordinator = DaynestDataUpdateCoordinator(
        hass=hass,
        config_entry=entry,
        client=client,
    )

    entry.runtime_data = DaynestData(
        client=client,
        integration=async_get_loaded_integration(hass, entry.domain),
        coordinator=coordinator,
    )

    await coordinator.async_config_entry_first_refresh()
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(async_reload_entry))

    if not hass.services.has_service(DOMAIN, "refresh"):
        await async_setup_services(hass)

    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok and not hass.config_entries.async_entries(DOMAIN):
        async_unload_services(hass)
    return unload_ok


async def async_reload_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
) -> None:
    """Reload a config entry."""
    await hass.config_entries.async_reload(entry.entry_id)
