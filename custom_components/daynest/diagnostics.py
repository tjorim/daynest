"""Diagnostics support for daynest.

Learn more about diagnostics:
https://developers.home-assistant.io/docs/core/integration_diagnostics
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from homeassistant.const import CONF_API_KEY, CONF_URL
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.redact import async_redact_data

from . import PLATFORMS
from .const import CONF_AUTH_MODE

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import DaynestConfigEntry

TO_REDACT = {
    CONF_API_KEY,
    CONF_URL,
    "username",
    "password",
    "api_key",
    "integration_key",
    "token",
    "access_token",
    "refresh_token",
    "id_token",
}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
) -> dict[str, Any]:
    """Return diagnostics for a config entry."""
    coordinator = entry.runtime_data.coordinator
    integration = entry.runtime_data.integration

    device_reg = dr.async_get(hass)
    entity_reg = er.async_get(hass)

    devices = dr.async_entries_for_config_entry(device_reg, entry.entry_id)
    device_info = []
    for device in devices:
        entities = er.async_entries_for_device(entity_reg, device.id)
        device_info.append(
            {
                "id": device.id,
                "name": device.name,
                "manufacturer": device.manufacturer,
                "model": device.model,
                "sw_version": device.sw_version,
                "entity_count": len(entities),
                "entities": [
                    {
                        "entity_id": entity.entity_id,
                        "platform": entity.platform,
                        "original_name": entity.original_name,
                        "disabled": entity.disabled,
                        "disabled_by": entity.disabled_by.value if entity.disabled_by else None,
                        "state": (
                            state.state
                            if (state := hass.states.get(entity.entity_id)) is not None
                            else None
                        ),
                    }
                    for entity in entities
                ],
            }
        )

    last_update_success_time = getattr(coordinator, "last_update_success_time", None)
    coordinator_info = {
        "last_update_success": coordinator.last_update_success,
        "last_update_success_time": str(last_update_success_time) if last_update_success_time else None,
        "last_exception": str(coordinator.last_exception) if coordinator.last_exception else None,
        "last_exception_type": type(coordinator.last_exception).__name__ if coordinator.last_exception else None,
        "update_interval": str(coordinator.update_interval),
        "contract_version": coordinator.data.get("integration_contract") if isinstance(coordinator.data, dict) else None,
        "data_keys": list(coordinator.data.keys()) if isinstance(coordinator.data, dict) else None,
    }

    integration_info = {
        "name": integration.name,
        "version": integration.version,
        "domain": integration.domain,
        "documentation": integration.documentation,
        "issue_tracker": integration.issue_tracker,
        "platforms": [str(p) for p in PLATFORMS],
    }

    entry_info = {
        "entry_id": entry.entry_id,
        "version": entry.version,
        "minor_version": entry.minor_version,
        "domain": entry.domain,
        "title": entry.title,
        "state": str(entry.state),
        "unique_id": entry.unique_id,
        "auth_mode": entry.data.get(CONF_AUTH_MODE, "unknown"),
        "disabled_by": entry.disabled_by.value if entry.disabled_by else None,
        "data": async_redact_data(entry.data, TO_REDACT),
        "options": async_redact_data(entry.options, TO_REDACT),
    }

    return {
        "entry": entry_info,
        "integration": integration_info,
        "coordinator": coordinator_info,
        "devices": device_info,
    }
