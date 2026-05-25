"""Home Assistant service handlers for the Daynest integration."""

from __future__ import annotations

from collections.abc import Awaitable
from datetime import UTC, date, datetime
from functools import partial
from typing import TYPE_CHECKING, Any

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
SERVICE_MARK_PLANNED_DONE = "mark_planned_done"
SERVICE_CREATE_PLANNED_ITEM = "create_planned_item"
SERVICE_UPDATE_PLANNED_ITEM = "update_planned_item"
SERVICE_SKIP_TASK = "skip_task"
SERVICE_SKIP_MEDICATION = "skip_medication"

ATTR_CHORE_INSTANCE_ID = "chore_instance_id"
ATTR_MEDICATION_DOSE_ID = "medication_dose_id"
ATTR_PLANNED_ITEM_ID = "planned_item_id"
ATTR_DAYS = "days"
ATTR_ENTRY_ID = "entry_id"
ATTR_TITLE = "title"
ATTR_PLANNED_FOR = "planned_for"
ATTR_NOTES = "notes"
ATTR_TIME_OF_DAY = "time_of_day"
ATTR_DURATION_MINUTES = "duration_minutes"
ATTR_MODULE_KEY = "module_key"
ATTR_RECURRENCE_HINT = "recurrence_hint"
ATTR_RRULE = "rrule"
ATTR_LINKED_SOURCE = "linked_source"
ATTR_LINKED_REF = "linked_ref"
ATTR_PRIORITY = "priority"
ATTR_TAGS = "tags"
ATTR_IS_DONE = "is_done"
ATTR_SCOPE = "scope"

SCOPE_THIS = "this"
SCOPE_FUTURE = "future"
SCOPE_ALL = "all"

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

SERVICE_MARK_PLANNED_DONE_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_PLANNED_ITEM_ID): vol.All(int, vol.Range(min=1)),
        vol.Optional(ATTR_ENTRY_ID): str,
    }
)

SERVICE_CREATE_PLANNED_ITEM_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_TITLE): vol.All(str, vol.Length(min=1)),
        vol.Optional(ATTR_PLANNED_FOR): vol.Any(str, date),
        vol.Optional(ATTR_NOTES): str,
        vol.Optional(ATTR_ENTRY_ID): str,
    }
)

SERVICE_UPDATE_PLANNED_ITEM_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_PLANNED_ITEM_ID): vol.All(int, vol.Range(min=1)),
        vol.Optional(ATTR_TITLE): vol.All(str, vol.Length(min=1)),
        vol.Optional(ATTR_PLANNED_FOR): vol.Any(str, date),
        vol.Optional(ATTR_TIME_OF_DAY): vol.Any(str, None),
        vol.Optional(ATTR_DURATION_MINUTES): vol.Any(vol.All(int, vol.Range(min=1)), None),
        vol.Optional(ATTR_NOTES): vol.Any(str, None),
        vol.Optional(ATTR_MODULE_KEY): vol.Any(str, None),
        vol.Optional(ATTR_RECURRENCE_HINT): vol.Any(str, None),
        vol.Optional(ATTR_RRULE): vol.Any(str, None),
        vol.Optional(ATTR_LINKED_SOURCE): vol.Any(str, None),
        vol.Optional(ATTR_LINKED_REF): vol.Any(str, None),
        vol.Optional(ATTR_PRIORITY): vol.Any(str, None),
        vol.Optional(ATTR_TAGS): vol.Any([str], None),
        vol.Optional(ATTR_IS_DONE): bool,
        vol.Optional(ATTR_SCOPE, default=SCOPE_THIS): vol.In([SCOPE_THIS, SCOPE_FUTURE, SCOPE_ALL]),
        vol.Optional(ATTR_ENTRY_ID): str,
    }
)


async def _call_client(
    entry: DaynestConfigEntry,
    service: str,
    entity_id: int,
    coro: Awaitable[Any],
) -> None:
    """Invoke a client action and map Daynest errors to HomeAssistantError."""
    try:
        await coro
    except DaynestAuthError as err:
        LOGGER.error("daynest.%s: authentication error for %s", service, entity_id)
        raise HomeAssistantError(
            translation_domain=DOMAIN,
            translation_key="service_auth_error",
            translation_placeholders={"service": service},
        ) from err
    except DaynestCommunicationError as err:
        LOGGER.error("daynest.%s: communication error for %s: %s", service, entity_id, err)
        raise HomeAssistantError(
            translation_domain=DOMAIN,
            translation_key="service_communication_error",
            translation_placeholders={"service": service},
        ) from err
    except DaynestError as err:
        LOGGER.error("daynest.%s: error for %s: %s", service, entity_id, err)
        raise HomeAssistantError(
            translation_domain=DOMAIN,
            translation_key="service_error",
            translation_placeholders={"service": service},
        ) from err
    LOGGER.debug("daynest.%s: %s succeeded", service, entity_id)
    await entry.runtime_data.coordinator.async_refresh()


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


def _resolve_planned_for(entry: DaynestConfigEntry, planned_for_raw: str | date | None) -> str:
    """Resolve planned_for value for create_planned_item calls."""
    if isinstance(planned_for_raw, date):
        return planned_for_raw.isoformat()
    if isinstance(planned_for_raw, str) and planned_for_raw:
        return planned_for_raw
    fallback_for_date = (entry.runtime_data.coordinator.data or {}).get("for_date")
    if isinstance(fallback_for_date, str) and fallback_for_date:
        return fallback_for_date
    return datetime.now(UTC).date().isoformat()


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
    entry = _get_single_entry(hass, SERVICE_COMPLETE_TASK, call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    await _call_client(
        entry, SERVICE_COMPLETE_TASK, chore_instance_id,
        entry.runtime_data.client.async_complete_task(chore_instance_id=chore_instance_id),
    )


async def _handle_snooze_task(hass: HomeAssistant, call: ServiceCall) -> None:
    """Reschedule a chore instance N days into the future."""
    chore_instance_id: int = call.data[ATTR_CHORE_INSTANCE_ID]
    days: int = call.data[ATTR_DAYS]
    entry = _get_single_entry(hass, SERVICE_SNOOZE_TASK, call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    await _call_client(
        entry, SERVICE_SNOOZE_TASK, chore_instance_id,
        entry.runtime_data.client.async_snooze_task(chore_instance_id=chore_instance_id, days=days),
    )


async def _handle_mark_medication_taken(hass: HomeAssistant, call: ServiceCall) -> None:
    """Mark a medication dose as taken."""
    medication_dose_id: int = call.data[ATTR_MEDICATION_DOSE_ID]
    entry = _get_single_entry(hass, SERVICE_MARK_MEDICATION_TAKEN, call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    await _call_client(
        entry, SERVICE_MARK_MEDICATION_TAKEN, medication_dose_id,
        entry.runtime_data.client.async_mark_medication_taken(medication_dose_id=medication_dose_id),
    )


async def _handle_skip_task(hass: HomeAssistant, call: ServiceCall) -> None:
    """Skip a chore instance."""
    chore_instance_id: int = call.data[ATTR_CHORE_INSTANCE_ID]
    entry = _get_single_entry(hass, SERVICE_SKIP_TASK, call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    await _call_client(
        entry, SERVICE_SKIP_TASK, chore_instance_id,
        entry.runtime_data.client.async_skip_task(chore_instance_id=chore_instance_id),
    )


async def _handle_skip_medication(hass: HomeAssistant, call: ServiceCall) -> None:
    """Skip a medication dose."""
    medication_dose_id: int = call.data[ATTR_MEDICATION_DOSE_ID]
    entry = _get_single_entry(hass, SERVICE_SKIP_MEDICATION, call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    await _call_client(
        entry, SERVICE_SKIP_MEDICATION, medication_dose_id,
        entry.runtime_data.client.async_skip_medication(medication_dose_id=medication_dose_id),
    )


async def _handle_mark_planned_done(hass: HomeAssistant, call: ServiceCall) -> None:
    """Mark a planned item as done."""
    planned_item_id: int = call.data[ATTR_PLANNED_ITEM_ID]
    entry = _get_single_entry(hass, SERVICE_MARK_PLANNED_DONE, call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    await _call_client(
        entry, SERVICE_MARK_PLANNED_DONE, planned_item_id,
        entry.runtime_data.client.async_mark_planned_done(planned_item_id=planned_item_id),
    )


async def _handle_create_planned_item(hass: HomeAssistant, call: ServiceCall) -> None:
    """Create a planned item."""
    entry = _get_single_entry(hass, SERVICE_CREATE_PLANNED_ITEM, call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    title: str = call.data[ATTR_TITLE]
    planned_for = _resolve_planned_for(entry, call.data.get(ATTR_PLANNED_FOR))
    notes: str | None = call.data.get(ATTR_NOTES)
    await _call_client(
        entry,
        SERVICE_CREATE_PLANNED_ITEM,
        0,
        entry.runtime_data.client.async_create_planned_item(
            title=title,
            planned_for=planned_for,
            notes=notes,
        ),
    )


async def _handle_update_planned_item(hass: HomeAssistant, call: ServiceCall) -> None:
    """Update a planned item."""
    planned_item_id: int = call.data[ATTR_PLANNED_ITEM_ID]
    scope: str = call.data.get(ATTR_SCOPE, SCOPE_THIS)
    entry = _get_single_entry(hass, SERVICE_UPDATE_PLANNED_ITEM, call.data.get(ATTR_ENTRY_ID))
    if entry is None:
        return
    patch_fields = {
        key: value
        for key, value in call.data.items()
        if key not in {ATTR_PLANNED_ITEM_ID, ATTR_SCOPE, ATTR_ENTRY_ID}
    }
    await _call_client(
        entry,
        SERVICE_UPDATE_PLANNED_ITEM,
        planned_item_id,
        entry.runtime_data.client.async_update_planned_item(item_id=planned_item_id, scope=scope, **patch_fields),
    )


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
    hass.services.async_register(
        DOMAIN, SERVICE_MARK_PLANNED_DONE, partial(_handle_mark_planned_done, hass), schema=SERVICE_MARK_PLANNED_DONE_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_CREATE_PLANNED_ITEM, partial(_handle_create_planned_item, hass), schema=SERVICE_CREATE_PLANNED_ITEM_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_UPDATE_PLANNED_ITEM, partial(_handle_update_planned_item, hass), schema=SERVICE_UPDATE_PLANNED_ITEM_SCHEMA
    )


def async_unload_services(hass: HomeAssistant) -> None:
    """Unregister Daynest services when the last entry is unloaded."""
    hass.services.async_remove(DOMAIN, SERVICE_REFRESH)
    hass.services.async_remove(DOMAIN, SERVICE_COMPLETE_TASK)
    hass.services.async_remove(DOMAIN, SERVICE_SNOOZE_TASK)
    hass.services.async_remove(DOMAIN, SERVICE_MARK_MEDICATION_TAKEN)
    hass.services.async_remove(DOMAIN, SERVICE_SKIP_TASK)
    hass.services.async_remove(DOMAIN, SERVICE_SKIP_MEDICATION)
    hass.services.async_remove(DOMAIN, SERVICE_MARK_PLANNED_DONE)
    hass.services.async_remove(DOMAIN, SERVICE_CREATE_PLANNED_ITEM)
    hass.services.async_remove(DOMAIN, SERVICE_UPDATE_PLANNED_ITEM)


__all__ = [
    "ATTR_CHORE_INSTANCE_ID",
    "ATTR_DAYS",
    "ATTR_ENTRY_ID",
    "ATTR_MEDICATION_DOSE_ID",
    "ATTR_MODULE_KEY",
    "ATTR_NOTES",
    "ATTR_PLANNED_FOR",
    "ATTR_PLANNED_ITEM_ID",
    "ATTR_PRIORITY",
    "ATTR_RECURRENCE_HINT",
    "ATTR_RRULE",
    "ATTR_SCOPE",
    "ATTR_TAGS",
    "ATTR_TIME_OF_DAY",
    "ATTR_TITLE",
    "SERVICE_COMPLETE_TASK",
    "SERVICE_CREATE_PLANNED_ITEM",
    "SERVICE_MARK_MEDICATION_TAKEN",
    "SERVICE_MARK_PLANNED_DONE",
    "SERVICE_REFRESH",
    "SERVICE_SKIP_MEDICATION",
    "SERVICE_SKIP_TASK",
    "SERVICE_SNOOZE_TASK",
    "SERVICE_UPDATE_PLANNED_ITEM",
    "async_setup_services",
    "async_unload_services",
]
