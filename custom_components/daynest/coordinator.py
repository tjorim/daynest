"""Data update coordinator for Daynest dashboard data."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta
from typing import Any

from daynest import (
    DaynestAuthError,
    DaynestClient,
    DaynestCommunicationError,
    DaynestError,
    DaynestMalformedResponseError,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.issue_registry import IssueSeverity, async_create_issue, async_delete_issue
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN, LOGGER, SUPPORTED_INTEGRATION_CONTRACT_VERSIONS, parse_integration_contract_version
from .data import DaynestConfigEntry

DEFAULT_POLL_INTERVAL_MINUTES = 15
MIN_POLL_INTERVAL_MINUTES = 1
MAX_POLL_INTERVAL_MINUTES = 60
POLL_INTERVAL_OPTION = "coordinator_poll_interval"
DASHBOARD_UPDATE_INTERVAL = timedelta(minutes=DEFAULT_POLL_INTERVAL_MINUTES)


def _safe_int(value: Any, default: int = 0) -> int:
    """Convert a value to int with fallback."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    """Convert a value to float with fallback."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_dict_list(value: Any) -> list[dict[str, Any]]:
    """Return a list containing only dictionary items."""
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _safe_date(value: Any) -> date | None:
    """Parse an ISO date value."""
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


class DaynestDataUpdateCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator that fetches and normalizes Daynest dashboard data."""

    config_entry: DaynestConfigEntry

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: DaynestConfigEntry,
        client: DaynestClient,
    ) -> None:
        """Initialize the coordinator with fixed polling interval."""
        poll_interval_minutes = _safe_int(config_entry.options.get(POLL_INTERVAL_OPTION), DEFAULT_POLL_INTERVAL_MINUTES)
        poll_interval_minutes = max(MIN_POLL_INTERVAL_MINUTES, min(poll_interval_minutes, MAX_POLL_INTERVAL_MINUTES))
        super().__init__(
            hass,
            logger=LOGGER,
            name=DOMAIN,
            config_entry=config_entry,
            update_interval=timedelta(minutes=poll_interval_minutes),
            always_update=False,
        )
        self._client = client
        self._last_dashboard_data: dict[str, Any] | None = None
        self._sse_unsubscribe: Callable[[], None] | None = None

    async def async_start_sse(self) -> None:
        """Refresh coordinator data when the backend emits today updates."""
        if self._sse_unsubscribe is not None:
            return
        self._sse_unsubscribe = await self._client.async_subscribe_today_updates(self._async_handle_today_update)

    def async_stop_sse(self) -> None:
        """Cancel the backend today update subscription."""
        if self._sse_unsubscribe is not None:
            self._sse_unsubscribe()
            self._sse_unsubscribe = None

    async def _async_handle_today_update(self, _payload: dict[str, Any]) -> None:
        await self.async_request_refresh()

    def _normalize_dashboard(self, payload: dict[str, Any], contract: str | None) -> dict[str, Any]:
        """Normalize dashboard payload into stable coordinator keys."""
        next_medication = payload.get("next_medication")
        if not isinstance(next_medication, (dict, str)) and next_medication is not None:
            next_medication = str(next_medication)

        completion_ratio = _safe_float(payload.get("completion_ratio"), default=0.0)
        completion_ratio = max(0.0, min(completion_ratio, 1.0))

        return {
            "for_date": payload.get("for_date"),
            "due_today_count": max(0, _safe_int(payload.get("due_today_count"), default=0)),
            "overdue_count": max(0, _safe_int(payload.get("overdue_count"), default=0)),
            "planned_count": max(0, _safe_int(payload.get("planned_count"), default=0)),
            "planned_remaining_count": max(0, _safe_int(payload.get("planned_remaining_count"), default=0)),
            "medication_due_count": max(0, _safe_int(payload.get("medication_due_count"), default=0)),
            "completion_ratio": completion_ratio,
            "next_medication": next_medication,
            "routines_open_count": max(0, _safe_int(payload.get("routines_open_count"), default=0)),
            "due_today": _safe_dict_list(payload.get("due_today")),
            "planned": _safe_dict_list(payload.get("planned")),
            "chores": _safe_dict_list(
                payload.get("chores") if payload.get("chores") is not None else payload.get("due_today")
            ),
            "medications": _safe_dict_list(payload.get("medications")),
            "planned_items": _safe_dict_list(
                payload.get("planned_items") if payload.get("planned_items") is not None else payload.get("planned")
            ),
            "integration_contract": contract,
        }

    @staticmethod
    def _overdue_chore_ids(data: dict[str, Any]) -> set[int]:
        """Return IDs of chores currently overdue."""
        today = _safe_date(data.get("for_date")) or date.today()
        overdue_ids: set[int] = set()
        for chore in _safe_dict_list(data.get("chores")):
            chore_id = _safe_int(chore.get("chore_instance_id"), default=0)
            status = str(chore.get("status") or "").lower()
            scheduled_date = _safe_date(chore.get("scheduled_date"))
            if chore_id > 0 and scheduled_date and scheduled_date < today and status not in {"completed", "done", "skipped"}:
                overdue_ids.add(chore_id)
        return overdue_ids

    @staticmethod
    def _missed_medication_ids(data: dict[str, Any]) -> set[int]:
        """Return IDs of medication doses currently marked missed."""
        missed_ids: set[int] = set()
        for dose in _safe_dict_list(data.get("medications")):
            dose_id = _safe_int(dose.get("medication_dose_instance_id"), default=0)
            status = str(dose.get("status") or "").lower()
            if dose_id > 0 and status == "missed":
                missed_ids.add(dose_id)
        return missed_ids

    def _fire_transition_events(self, previous: dict[str, Any] | None, current: dict[str, Any]) -> None:
        """Fire Home Assistant events for relevant Daynest transitions."""
        previous_data = previous or {}
        previous_overdue = self._overdue_chore_ids(previous_data)
        current_overdue = self._overdue_chore_ids(current)
        for chore_id in sorted(current_overdue - previous_overdue):
            self.hass.bus.async_fire("daynest_chore_overdue", {"chore_instance_id": chore_id})

        previous_missed = self._missed_medication_ids(previous_data)
        current_missed = self._missed_medication_ids(current)
        for medication_dose_id in sorted(current_missed - previous_missed):
            self.hass.bus.async_fire("daynest_medication_missed", {"medication_dose_instance_id": medication_dose_id})

        previous_completion = _safe_float(previous_data.get("completion_ratio"), 0.0)
        current_completion = _safe_float(current.get("completion_ratio"), 0.0)
        if previous_completion < 1.0 and current_completion >= 1.0:
            self.hass.bus.async_fire("daynest_day_complete", {"for_date": current.get("for_date")})

    async def async_set_poll_interval(self, minutes: int) -> None:
        """Update coordinator polling interval without a reload."""
        bounded_minutes = max(MIN_POLL_INTERVAL_MINUTES, min(int(minutes), MAX_POLL_INTERVAL_MINUTES))
        self.update_interval = timedelta(minutes=bounded_minutes)
        self._schedule_refresh()

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch dashboard data and map backend errors to HA coordinator errors."""
        try:
            response = await self._client.async_get_dashboard()
        except DaynestAuthError as err:
            raise ConfigEntryAuthFailed from err
        except DaynestCommunicationError as err:
            raise UpdateFailed(f"Temporary communication failure: {err}") from err
        except DaynestMalformedResponseError as err:
            raise UpdateFailed(f"Malformed dashboard response: {err}") from err
        except DaynestError as err:
            raise UpdateFailed(f"Unexpected API error while updating dashboard: {err}") from err

        parsed_contract = parse_integration_contract_version(response.integration_contract)
        if parsed_contract not in SUPPORTED_INTEGRATION_CONTRACT_VERSIONS:
            unsupported_token = parsed_contract or response.integration_contract or "missing"
            async_create_issue(
                self.hass,
                DOMAIN,
                "unsupported_contract_version",
                is_fixable=False,
                severity=IssueSeverity.ERROR,
                translation_key="unsupported_contract_version",
                translation_placeholders={"contract": unsupported_token},
            )
            raise UpdateFailed(f"Unsupported or missing integration contract version: {unsupported_token}")

        async_delete_issue(self.hass, DOMAIN, "unsupported_contract_version")
        normalized = self._normalize_dashboard(response.data.payload, parsed_contract)
        try:
            settings = await self._client.async_get_user_settings()
        except DaynestError:
            settings = {}
        if not isinstance(settings, dict):
            settings = {}
        normalized["default_snooze_days"] = max(1, min(_safe_int(settings.get("default_snooze_days"), 1), 14))
        normalized["medication_reminder_minutes"] = max(0, _safe_int(settings.get("medication_reminder_minutes"), 0))
        if self._last_dashboard_data is not None:
            self._fire_transition_events(self._last_dashboard_data, normalized)
        self._last_dashboard_data = normalized
        return normalized


__all__ = [
    "DASHBOARD_UPDATE_INTERVAL",
    "DEFAULT_POLL_INTERVAL_MINUTES",
    "MAX_POLL_INTERVAL_MINUTES",
    "MIN_POLL_INTERVAL_MINUTES",
    "POLL_INTERVAL_OPTION",
    "DaynestDataUpdateCoordinator",
]
