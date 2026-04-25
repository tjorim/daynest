"""Data update coordinator for Daynest dashboard data."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import (
    DaynestApiClient,
    DaynestApiClientAuthenticationError,
    DaynestApiClientCommunicationError,
    DaynestApiClientError,
    DaynestApiClientMalformedResponseError,
)
from .const import DOMAIN, LOGGER, SUPPORTED_INTEGRATION_CONTRACT_VERSIONS, parse_integration_contract_version
from .data import DaynestConfigEntry

DASHBOARD_UPDATE_INTERVAL = timedelta(minutes=15)


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


class DaynestDataUpdateCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator that fetches and normalizes Daynest dashboard data."""

    config_entry: DaynestConfigEntry

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: DaynestConfigEntry,
        client: DaynestApiClient,
    ) -> None:
        """Initialize the coordinator with fixed polling interval."""
        super().__init__(
            hass,
            logger=LOGGER,
            name=DOMAIN,
            config_entry=config_entry,
            update_interval=DASHBOARD_UPDATE_INTERVAL,
            always_update=False,
        )
        self._client = client

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
            "medication_due_count": max(0, _safe_int(payload.get("medication_due_count"), default=0)),
            "completion_ratio": completion_ratio,
            "next_medication": next_medication,
            "integration_contract": contract,
            "model": str(payload.get("model", "Daynest")),
        }

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch dashboard data and map backend errors to HA coordinator errors."""
        try:
            response = await self._client.async_get_dashboard()
        except DaynestApiClientAuthenticationError as err:
            raise ConfigEntryAuthFailed from err
        except DaynestApiClientCommunicationError as err:
            raise UpdateFailed(f"Temporary communication failure: {err}") from err
        except DaynestApiClientMalformedResponseError as err:
            raise UpdateFailed(f"Malformed dashboard response: {err}") from err
        except DaynestApiClientError as err:
            raise UpdateFailed(f"Unexpected API error while updating dashboard: {err}") from err

        parsed_contract = parse_integration_contract_version(response.integration_contract)
        if parsed_contract not in SUPPORTED_INTEGRATION_CONTRACT_VERSIONS:
            unsupported_token = parsed_contract or response.integration_contract or "missing"
            raise UpdateFailed(f"Unsupported or missing integration contract version: {unsupported_token}")

        return self._normalize_dashboard(response.data.payload, parsed_contract)


__all__ = ["DASHBOARD_UPDATE_INTERVAL", "DaynestDataUpdateCoordinator"]
