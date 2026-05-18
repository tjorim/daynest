"""Home Assistant service handlers for the Daynest integration."""

from __future__ import annotations

from functools import partial
from typing import TYPE_CHECKING

import voluptuous as vol

from daynest import DaynestAuthError, DaynestCommunicationError, DaynestError
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN, LOGGER

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant, ServiceCall

    from .data import DaynestConfigEntry

SERVICE_REFRESH = "refresh"
SERVICE_COMPLETE_TASK = "complete_task"
SERVICE_SNOOZE_TASK = "snooze_task"
SERVICE_MARK_MEDICATION_TAKEN = "mark_medication_taken"
SERVICE_SKIP_TASK = "skip_task"
SERVICE_SKIP_MEDICATION = "skip_medication"

ATTR_CHORE_INSTANCE_ID = "chore_instance_id"
ATTR_MEDICATION_DOSE_ID = "medication_dose_id"
ATTR_DAYS = "days"
ATTR_ENTRY_ID = "entry_id"

SERVICE_COMPLETE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CHORE_INSTANCE_ID): vol.All(int, vol.Range(min=1)),
        vol.Optional(ATTR_ENTRY_ID): str,
    }
)

SERVICE_SNOOZE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CHORE_INSTANCE_ID): vol.All(int, vol.Range(min=1)),
        vol.Optional(ATTR_DAYS, default=1): vol.All(int, vol.Range(min=1, max=30)),
        vol.Optional(ATTR_ENTRY_ID): str,
    }
)

SERVICE_MARK_MEDICATION_TAKEN_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_MEDICATION_DOSE_ID): vol.All(int, vol.Range(min=1)),
        vol.Optional(ATTR_ENTRY_ID): str,
    }
)

SERVICE_SKIP_TASK_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CHORE_INSTANCE_ID): vol.All(int, vol.Range(min=1)),
        vol.Optional(ATTR_ENTRY_ID): str,
    }
)

SERVICE_SKIP_MEDICATION_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_MEDICATION_DOSE_ID): vol.All(int, vol.Range(min=1)),
        vol.Optional(ATTR_ENTRY_ID): str,
    }
)


def _get_entries(hass: HomeAssistant) -> list[DaynestConfigEntry]:
    """Return all loaded Daynest config entries."""
    return hass.config_entries.async_entries(DOMAIN)  # type: ignore[return-value]


def _get_single_entry(
    hass: HomeAssistant,
    service_name: str,
    entry_id: str | None = None,
) -> DaynestConfigEntry | None:
    """Return the matching entry, falling back to single-entry behaviour when entry_id is omitted."""
    entries = _get_entries(hass)
    if not entries:
        LOGGER.warning("daynest.%s called but no Daynest entries are loaded", service_name)
        return None
    if entry_id is not None:
        for entry in entries:
            if entry.entry_id == entry_id:
                return entry
        LOGGER.warning("daynest.%s: entry_id %s not found", service_name, entry_id)
        return None
    if len(entries) != 1:
        LOGGER.warning(
            "daynest.%s: multiple Daynest entries loaded; specify an entry_id to target",
            service_name,
        )
        return None
    return entries[0]


async def _handle_refresh(hass: HomeAssistant, call: ServiceCall) -> None:
    """Trigger an immediate coordinator refresh for all Daynest entries."""
    entries = _get_entries(hass)
    if not entries:
        LOGGER.warning("daynest.refresh called but no Daynest entries are loaded")
        return
    for entry in entries:
        LOGGER.debug("Refreshing Daynest coordinator for entry %s", entry.entry_id)
        await entry.runtime_data.coordinator.async_refresh()


async def _handle_complete_task(hass: HomeAssistant, call: ServiceCall) -> None:
    """Mark a chore instance as complete."""
    chore_instance_id: int = call.data[ATTR_CHORE_INSTANCE_ID]
    entry = _get_single_entry(hass, "complete_task", call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    try:
        await entry.runtime_data.client.async_complete_task(chore_instance_id=chore_instance_id)
    except DaynestAuthError as err:
        LOGGER.error("daynest.complete_task: authentication error for chore %s", chore_instance_id)
        raise HomeAssistantError(f"Authentication error completing chore {chore_instance_id}") from err
    except DaynestCommunicationError as err:
        LOGGER.error("daynest.complete_task: communication error for chore %s: %s", chore_instance_id, err)
        raise HomeAssistantError(f"Communication error completing chore {chore_instance_id}") from err
    except DaynestError as err:
        LOGGER.error("daynest.complete_task: unexpected error for chore %s: %s", chore_instance_id, err)
        raise HomeAssistantError(f"Error completing chore {chore_instance_id}") from err
    LOGGER.debug("daynest.complete_task: chore %s marked as complete", chore_instance_id)
    await entry.runtime_data.coordinator.async_refresh()


async def _handle_snooze_task(hass: HomeAssistant, call: ServiceCall) -> None:
    """Reschedule a chore instance N days into the future."""
    chore_instance_id: int = call.data[ATTR_CHORE_INSTANCE_ID]
    days: int = call.data[ATTR_DAYS]
    entry = _get_single_entry(hass, "snooze_task", call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    try:
        await entry.runtime_data.client.async_snooze_task(chore_instance_id=chore_instance_id, days=days)
    except DaynestAuthError as err:
        LOGGER.error("daynest.snooze_task: authentication error for chore %s", chore_instance_id)
        raise HomeAssistantError(f"Authentication error snoozing chore {chore_instance_id}") from err
    except DaynestCommunicationError as err:
        LOGGER.error("daynest.snooze_task: communication error for chore %s: %s", chore_instance_id, err)
        raise HomeAssistantError(f"Communication error snoozing chore {chore_instance_id}") from err
    except DaynestError as err:
        LOGGER.error("daynest.snooze_task: unexpected error for chore %s: %s", chore_instance_id, err)
        raise HomeAssistantError(f"Error snoozing chore {chore_instance_id}") from err
    LOGGER.debug("daynest.snooze_task: chore %s snoozed by %s day(s)", chore_instance_id, days)
    await entry.runtime_data.coordinator.async_refresh()


async def _handle_mark_medication_taken(hass: HomeAssistant, call: ServiceCall) -> None:
    """Mark a medication dose as taken."""
    medication_dose_id: int = call.data[ATTR_MEDICATION_DOSE_ID]
    entry = _get_single_entry(hass, "mark_medication_taken", call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    try:
        await entry.runtime_data.client.async_mark_medication_taken(medication_dose_id=medication_dose_id)
    except DaynestAuthError as err:
        LOGGER.error("daynest.mark_medication_taken: authentication error for dose %s", medication_dose_id)
        raise HomeAssistantError(f"Authentication error marking dose {medication_dose_id} taken") from err
    except DaynestCommunicationError as err:
        LOGGER.error("daynest.mark_medication_taken: communication error for dose %s: %s", medication_dose_id, err)
        raise HomeAssistantError(f"Communication error marking dose {medication_dose_id} taken") from err
    except DaynestError as err:
        LOGGER.error("daynest.mark_medication_taken: unexpected error for dose %s: %s", medication_dose_id, err)
        raise HomeAssistantError(f"Error marking dose {medication_dose_id} taken") from err
    LOGGER.debug("daynest.mark_medication_taken: dose %s marked as taken", medication_dose_id)
    await entry.runtime_data.coordinator.async_refresh()


async def _handle_skip_task(hass: HomeAssistant, call: ServiceCall) -> None:
    """Skip a chore instance."""
    chore_instance_id: int = call.data[ATTR_CHORE_INSTANCE_ID]
    entry = _get_single_entry(hass, "skip_task", call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    try:
        await entry.runtime_data.client.async_skip_task(chore_instance_id=chore_instance_id)
    except DaynestAuthError as err:
        LOGGER.error("daynest.skip_task: authentication error for chore %s", chore_instance_id)
        raise HomeAssistantError(f"Authentication error skipping chore {chore_instance_id}") from err
    except DaynestCommunicationError as err:
        LOGGER.error("daynest.skip_task: communication error for chore %s: %s", chore_instance_id, err)
        raise HomeAssistantError(f"Communication error skipping chore {chore_instance_id}") from err
    except DaynestError as err:
        LOGGER.error("daynest.skip_task: unexpected error for chore %s: %s", chore_instance_id, err)
        raise HomeAssistantError(f"Error skipping chore {chore_instance_id}") from err
    LOGGER.debug("daynest.skip_task: chore %s skipped", chore_instance_id)
    await entry.runtime_data.coordinator.async_refresh()


async def _handle_skip_medication(hass: HomeAssistant, call: ServiceCall) -> None:
    """Skip a medication dose."""
    medication_dose_id: int = call.data[ATTR_MEDICATION_DOSE_ID]
    entry = _get_single_entry(hass, "skip_medication", call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    try:
        await entry.runtime_data.client.async_skip_medication(medication_dose_id=medication_dose_id)
    except DaynestAuthError as err:
        LOGGER.error("daynest.skip_medication: authentication error for dose %s", medication_dose_id)
        raise HomeAssistantError(f"Authentication error skipping dose {medication_dose_id}") from err
    except DaynestCommunicationError as err:
        LOGGER.error("daynest.skip_medication: communication error for dose %s: %s", medication_dose_id, err)
        raise HomeAssistantError(f"Communication error skipping dose {medication_dose_id}") from err
    except DaynestError as err:
        LOGGER.error("daynest.skip_medication: unexpected error for dose %s: %s", medication_dose_id, err)
        raise HomeAssistantError(f"Error skipping dose {medication_dose_id}") from err
    LOGGER.debug("daynest.skip_medication: dose %s skipped", medication_dose_id)
    await entry.runtime_data.coordinator.async_refresh()


async def async_setup_services(hass: HomeAssistant) -> None:
    """Register Daynest Home Assistant services."""
    hass.services.async_register(DOMAIN, SERVICE_REFRESH, partial(_handle_refresh, hass))
    hass.services.async_register(
        DOMAIN, SERVICE_COMPLETE_TASK, partial(_handle_complete_task, hass), schema=SERVICE_COMPLETE_TASK_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_SNOOZE_TASK, partial(_handle_snooze_task, hass), schema=SERVICE_SNOOZE_TASK_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_MARK_MEDICATION_TAKEN, partial(_handle_mark_medication_taken, hass), schema=SERVICE_MARK_MEDICATION_TAKEN_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_SKIP_TASK, partial(_handle_skip_task, hass), schema=SERVICE_SKIP_TASK_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_SKIP_MEDICATION, partial(_handle_skip_medication, hass), schema=SERVICE_SKIP_MEDICATION_SCHEMA
    )


def async_unload_services(hass: HomeAssistant) -> None:
    """Unregister Daynest services when the last entry is unloaded."""
    hass.services.async_remove(DOMAIN, SERVICE_REFRESH)
    hass.services.async_remove(DOMAIN, SERVICE_COMPLETE_TASK)
    hass.services.async_remove(DOMAIN, SERVICE_SNOOZE_TASK)
    hass.services.async_remove(DOMAIN, SERVICE_MARK_MEDICATION_TAKEN)
    hass.services.async_remove(DOMAIN, SERVICE_SKIP_TASK)
    hass.services.async_remove(DOMAIN, SERVICE_SKIP_MEDICATION)


__all__ = [
    "ATTR_CHORE_INSTANCE_ID",
    "ATTR_DAYS",
    "ATTR_ENTRY_ID",
    "ATTR_MEDICATION_DOSE_ID",
    "SERVICE_COMPLETE_TASK",
    "SERVICE_MARK_MEDICATION_TAKEN",
    "SERVICE_REFRESH",
    "SERVICE_SKIP_MEDICATION",
    "SERVICE_SKIP_TASK",
    "SERVICE_SNOOZE_TASK",
    "async_setup_services",
    "async_unload_services",
]
