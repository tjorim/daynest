"""Home Assistant service handlers for the Daynest integration."""

from __future__ import annotations

from typing import TYPE_CHECKING

import voluptuous as vol

from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .api import (
    DaynestApiClientAuthenticationError,
    DaynestApiClientCommunicationError,
    DaynestApiClientError,
)
from .const import DOMAIN, LOGGER

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant, ServiceCall

    from .data import DaynestConfigEntry

SERVICE_REFRESH = "refresh"
SERVICE_COMPLETE_TASK = "complete_task"
SERVICE_SNOOZE_TASK = "snooze_task"
SERVICE_MARK_MEDICATION_TAKEN = "mark_medication_taken"

ATTR_TASK_ID = "task_id"
ATTR_MEDICATION_DOSE_ID = "medication_dose_id"
ATTR_DAYS = "days"

SERVICE_COMPLETE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_TASK_ID): vol.All(int, vol.Range(min=1)),
    }
)

SERVICE_SNOOZE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_TASK_ID): vol.All(int, vol.Range(min=1)),
        vol.Optional(ATTR_DAYS, default=1): vol.All(int, vol.Range(min=1, max=30)),
    }
)

SERVICE_MARK_MEDICATION_TAKEN_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_MEDICATION_DOSE_ID): vol.All(int, vol.Range(min=1)),
    }
)


def _get_entries(hass: HomeAssistant) -> list[DaynestConfigEntry]:
    """Return all loaded Daynest config entries."""
    return hass.config_entries.async_entries(DOMAIN)  # type: ignore[return-value]


async def async_setup_services(hass: HomeAssistant) -> None:
    """Register Daynest Home Assistant services."""

    async def handle_refresh(call: ServiceCall) -> None:
        """Trigger an immediate coordinator refresh for all Daynest entries."""
        entries = _get_entries(hass)
        if not entries:
            LOGGER.warning("daynest.refresh called but no Daynest entries are loaded")
            return
        for entry in entries:
            LOGGER.debug("Refreshing Daynest coordinator for entry %s", entry.entry_id)
            await entry.runtime_data.coordinator.async_refresh()

    async def handle_complete_task(call: ServiceCall) -> None:
        """Mark a chore instance as complete."""
        task_id: int = call.data[ATTR_TASK_ID]
        entries = _get_entries(hass)
        if not entries:
            LOGGER.warning("daynest.complete_task called but no Daynest entries are loaded")
            return
        if len(entries) != 1:
            LOGGER.warning(
                "daynest.complete_task: multiple Daynest entries loaded; specify an entry_id to target"
            )
            return
        entry = entries[0]
        try:
            await entry.runtime_data.client.async_complete_task(task_id=task_id)
        except DaynestApiClientAuthenticationError as err:
            LOGGER.error("daynest.complete_task: authentication error for task %s", task_id)
            raise HomeAssistantError(f"Authentication error completing task {task_id}") from err
        except DaynestApiClientCommunicationError as err:
            LOGGER.error("daynest.complete_task: communication error for task %s: %s", task_id, err)
            raise HomeAssistantError(f"Communication error completing task {task_id}") from err
        except DaynestApiClientError as err:
            LOGGER.error("daynest.complete_task: unexpected error for task %s: %s", task_id, err)
            raise HomeAssistantError(f"Error completing task {task_id}") from err
        LOGGER.debug("daynest.complete_task: task %s marked as complete", task_id)
        await entry.runtime_data.coordinator.async_refresh()

    async def handle_snooze_task(call: ServiceCall) -> None:
        """Reschedule a chore instance N days into the future."""
        task_id: int = call.data[ATTR_TASK_ID]
        days: int = call.data[ATTR_DAYS]
        entries = _get_entries(hass)
        if not entries:
            LOGGER.warning("daynest.snooze_task called but no Daynest entries are loaded")
            return
        if len(entries) != 1:
            LOGGER.warning(
                "daynest.snooze_task: multiple Daynest entries loaded; specify an entry_id to target"
            )
            return
        entry = entries[0]
        try:
            await entry.runtime_data.client.async_snooze_task(task_id=task_id, days=days)
        except DaynestApiClientAuthenticationError as err:
            LOGGER.error("daynest.snooze_task: authentication error for task %s", task_id)
            raise HomeAssistantError(f"Authentication error snoozing task {task_id}") from err
        except DaynestApiClientCommunicationError as err:
            LOGGER.error("daynest.snooze_task: communication error for task %s: %s", task_id, err)
            raise HomeAssistantError(f"Communication error snoozing task {task_id}") from err
        except DaynestApiClientError as err:
            LOGGER.error("daynest.snooze_task: unexpected error for task %s: %s", task_id, err)
            raise HomeAssistantError(f"Error snoozing task {task_id}") from err
        LOGGER.debug("daynest.snooze_task: task %s snoozed by %s day(s)", task_id, days)
        await entry.runtime_data.coordinator.async_refresh()

    async def handle_mark_medication_taken(call: ServiceCall) -> None:
        """Mark a medication dose as taken."""
        medication_dose_id: int = call.data[ATTR_MEDICATION_DOSE_ID]
        entries = _get_entries(hass)
        if not entries:
            LOGGER.warning("daynest.mark_medication_taken called but no Daynest entries are loaded")
            return
        if len(entries) != 1:
            LOGGER.warning(
                "daynest.mark_medication_taken: multiple Daynest entries loaded; specify an entry_id to target"
            )
            return
        entry = entries[0]
        try:
            await entry.runtime_data.client.async_mark_medication_taken(medication_dose_id=medication_dose_id)
        except DaynestApiClientAuthenticationError as err:
            LOGGER.error(
                "daynest.mark_medication_taken: authentication error for dose %s", medication_dose_id
            )
            raise HomeAssistantError(f"Authentication error marking dose {medication_dose_id} taken") from err
        except DaynestApiClientCommunicationError as err:
            LOGGER.error(
                "daynest.mark_medication_taken: communication error for dose %s: %s", medication_dose_id, err
            )
            raise HomeAssistantError(f"Communication error marking dose {medication_dose_id} taken") from err
        except DaynestApiClientError as err:
            LOGGER.error(
                "daynest.mark_medication_taken: unexpected error for dose %s: %s", medication_dose_id, err
            )
            raise HomeAssistantError(f"Error marking dose {medication_dose_id} taken") from err
        LOGGER.debug("daynest.mark_medication_taken: dose %s marked as taken", medication_dose_id)
        await entry.runtime_data.coordinator.async_refresh()

    hass.services.async_register(DOMAIN, SERVICE_REFRESH, handle_refresh)
    hass.services.async_register(
        DOMAIN, SERVICE_COMPLETE_TASK, handle_complete_task, schema=SERVICE_COMPLETE_TASK_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_SNOOZE_TASK, handle_snooze_task, schema=SERVICE_SNOOZE_TASK_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_MARK_MEDICATION_TAKEN, handle_mark_medication_taken, schema=SERVICE_MARK_MEDICATION_TAKEN_SCHEMA
    )


def async_unload_services(hass: HomeAssistant) -> None:
    """Unregister Daynest services when the last entry is unloaded."""
    hass.services.async_remove(DOMAIN, SERVICE_REFRESH)
    hass.services.async_remove(DOMAIN, SERVICE_COMPLETE_TASK)
    hass.services.async_remove(DOMAIN, SERVICE_SNOOZE_TASK)
    hass.services.async_remove(DOMAIN, SERVICE_MARK_MEDICATION_TAKEN)


__all__ = [
    "ATTR_DAYS",
    "ATTR_MEDICATION_DOSE_ID",
    "ATTR_TASK_ID",
    "SERVICE_COMPLETE_TASK",
    "SERVICE_MARK_MEDICATION_TAKEN",
    "SERVICE_REFRESH",
    "SERVICE_SNOOZE_TASK",
    "async_setup_services",
    "async_unload_services",
]
