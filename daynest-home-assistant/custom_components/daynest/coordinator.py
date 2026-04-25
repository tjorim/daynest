"""Data update coordinator for Daynest dashboard data."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import (
    DaynestApiClient,
    DaynestApiClientAuthenticationError,
    DaynestApiClientCommunicationError,
    DaynestApiClientError,
    DaynestApiClientMalformedResponseError,
)
from .const import DOMAIN, LOGGER
from .data import DaynestConfigEntry

SUPPORTED_CONTRACT_VERSIONS = frozenset({"1"})
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
        hass,
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
        self.data = self._default_data()

    def _default_data(self) -> dict[str, Any]:
        """Return stable default payload used before first successful refresh."""
        return {
            "due_today_count": 0,
            "overdue_count": 0,
            "completion_ratio": 0.0,
            "next_medication": None,
            "integration_contract": None,
            # Compatibility keys for existing entities expecting a dict payload.
            "userId": 0,
            "id": 0,
            "model": "Daynest",
        }

    def _normalize_dashboard(self, payload: dict[str, Any], contract: str) -> dict[str, Any]:
        """Normalize dashboard payload into stable coordinator keys."""
        next_medication = payload.get("nextMedication")
        if not isinstance(next_medication, dict):
            next_medication = None

        completion_ratio = _safe_float(payload.get("completionRatio"), default=0.0)
        completion_ratio = max(0.0, min(completion_ratio, 1.0))

        return {
            "due_today_count": max(0, _safe_int(payload.get("dueTodayCount"), default=0)),
            "overdue_count": max(0, _safe_int(payload.get("overdueCount"), default=0)),
            "completion_ratio": completion_ratio,
            "next_medication": next_medication,
            "integration_contract": contract,
            # Compatibility keys for existing entities until they are migrated.
            "userId": max(0, _safe_int(payload.get("userId"), default=0)),
            "id": max(0, _safe_int(payload.get("id"), default=0)),
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

        contract = response.integration_contract
        if contract not in SUPPORTED_CONTRACT_VERSIONS:
            raise UpdateFailed(f"Unsupported or missing integration contract header: {contract}")

        return self._normalize_dashboard(response.data.payload, contract)


__all__ = ["DASHBOARD_UPDATE_INTERVAL", "DaynestDataUpdateCoordinator"]
