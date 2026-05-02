"""HTTP API client for Daynest backend integration endpoints."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Generic, TypeVar
from urllib.parse import urljoin

import aiohttp

from ..const import DEFAULT_API_BASE_URL

REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)


class DaynestApiClientError(Exception):
    """Base exception for API client failures."""


class DaynestApiClientCommunicationError(DaynestApiClientError):
    """Generic transport-level failure."""


class DaynestApiClientAuthenticationError(DaynestApiClientError):
    """Authentication/authorization failure reported by backend."""


class DaynestApiClientTimeoutError(DaynestApiClientCommunicationError):
    """Request timed out before receiving a response."""


class DaynestApiClientServerUnavailableError(DaynestApiClientCommunicationError):
    """Backend is unavailable or returned an upstream/server error."""


class DaynestApiClientMalformedResponseError(DaynestApiClientError):
    """Response payload could not be parsed into expected model."""


@dataclass(slots=True, frozen=True)
class DaynestSummary:
    """Typed model for `/summary` payload."""

    payload: dict[str, Any]

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> DaynestSummary:
        """Build a typed summary model from raw JSON payload."""
        required_keys = {
            "todo_daynest_today",
            "sensor_daynest_overdue_count",
            "sensor_daynest_next_medication",
        }
        missing_keys = sorted(required_keys.difference(payload))
        if missing_keys:
            missing = ", ".join(missing_keys)
            msg = f"Malformed summary payload: missing required keys ({missing})"
            raise DaynestApiClientMalformedResponseError(msg)

        return cls(payload=payload)


@dataclass(slots=True, frozen=True)
class DaynestDashboard:
    """Typed model for `/dashboard` payload."""

    payload: dict[str, Any]

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> DaynestDashboard:
        """Build a typed dashboard model from raw JSON payload."""
        if not isinstance(payload, dict):
            msg = "Malformed dashboard payload: expected JSON object"
            raise DaynestApiClientMalformedResponseError(msg)
        required_keys = {
            "for_date",
            "due_today_count",
            "overdue_count",
            "planned_count",
            "medication_due_count",
            "completion_ratio",
            "next_medication",
        }
        missing_keys = sorted(required_keys.difference(payload))
        if missing_keys:
            missing = ", ".join(missing_keys)
            msg = f"Malformed dashboard payload: missing required keys ({missing})"
            raise DaynestApiClientMalformedResponseError(msg)
        return cls(payload=payload)


ModelT = TypeVar("ModelT")


@dataclass(slots=True, frozen=True)
class DaynestApiResponse(Generic[ModelT]):
    """Typed response wrapper carrying contract metadata."""

    data: ModelT
    integration_contract: str | None


class DaynestApiClient:
    """Thin HTTP client for Daynest Home Assistant integration backend."""

    def __init__(
        self,
        session: aiohttp.ClientSession,
        base_url: str | None = None,
        integration_key: str | None = None,
        *,
        password: str | None = None,
    ) -> None:
        """Initialize client."""
        if base_url is not None and not base_url.strip():
            msg = "A base URL is required to initialize DaynestApiClient"
            raise ValueError(msg)
        resolved_base_url = (base_url or DEFAULT_API_BASE_URL).strip().rstrip("/")

        self._session = session
        self._base_url = resolved_base_url
        self._integration_key = integration_key if integration_key is not None else password

    @property
    def has_integration_key(self) -> bool:
        """Return whether the client has an integration key configured."""
        return bool(self._integration_key)

    async def async_get_data(self) -> dict[str, Any]:
        """Fetch summary data as the coordinator's primary payload."""
        response = await self.async_get_summary()
        return response.data.payload

    async def async_get_summary(self) -> DaynestApiResponse[DaynestSummary]:
        """Fetch and parse the integration summary endpoint."""
        return await self._request_model(
            path="/api/v1/integrations/home-assistant/summary",
            parser=DaynestSummary.from_dict,
        )

    async def async_get_dashboard(self) -> DaynestApiResponse[DaynestDashboard]:
        """Fetch and parse the integration dashboard endpoint."""
        return await self._request_model(
            path="/api/v1/integrations/home-assistant/dashboard",
            parser=DaynestDashboard.from_dict,
        )

    async def async_complete_task(self, task_id: int) -> dict[str, Any]:
        """Complete a chore instance by ID via the HA write endpoint."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/complete-task",
            payload={"task_id": task_id},
        )

    async def async_snooze_task(self, task_id: int, days: int = 1) -> dict[str, Any]:
        """Reschedule a chore instance N days into the future via the HA write endpoint."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/snooze-task",
            payload={"task_id": task_id, "days": days},
        )

    async def async_mark_medication_taken(self, medication_dose_id: int) -> dict[str, Any]:
        """Mark a medication dose as taken via the HA write endpoint."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/mark-medication-taken",
            payload={"medication_dose_id": medication_dose_id},
        )

    async def _request_model(
        self,
        path: str,
        parser: Callable[[dict[str, Any]], ModelT],
    ) -> DaynestApiResponse[ModelT]:
        """Request JSON endpoint and parse into a typed model."""
        url = urljoin(f"{self._base_url}/", path.lstrip("/"))
        headers = {"Accept": "application/json"}
        if self._integration_key:
            headers["X-Integration-Key"] = self._integration_key

        try:
            async with self._session.get(url, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                if response.status in (401, 403):
                    msg = f"Authentication failed with status {response.status}"
                    raise DaynestApiClientAuthenticationError(msg)
                if 500 <= response.status < 600:
                    msg = f"Backend unavailable (status {response.status})"
                    raise DaynestApiClientServerUnavailableError(msg)
                response.raise_for_status()

                contract = response.headers.get("X-Integration-Contract")

                payload = await response.json(content_type=None)
                if not isinstance(payload, dict):
                    msg = "Malformed response payload: expected JSON object"
                    raise DaynestApiClientMalformedResponseError(msg)

                model = parser(payload)
                return DaynestApiResponse(data=model, integration_contract=contract)

        except TimeoutError as err:
            msg = f"Request timed out for endpoint {path}"
            raise DaynestApiClientTimeoutError(msg) from err
        except aiohttp.ClientConnectionError as err:
            msg = f"Server unavailable while requesting endpoint {path}: {err}"
            raise DaynestApiClientServerUnavailableError(msg) from err
        except aiohttp.ClientError as err:
            msg = f"Communication error while requesting endpoint {path}: {err}"
            raise DaynestApiClientCommunicationError(msg) from err
        except ValueError as err:
            msg = f"Malformed JSON response for endpoint {path}: {err}"
            raise DaynestApiClientMalformedResponseError(msg) from err

    async def _post_action(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        """POST to a write endpoint and return the JSON response body."""
        url = urljoin(f"{self._base_url}/", path.lstrip("/"))
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self._integration_key:
            headers["X-Integration-Key"] = self._integration_key

        try:
            async with self._session.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                if response.status in (401, 403):
                    msg = f"Authentication failed with status {response.status}"
                    raise DaynestApiClientAuthenticationError(msg)
                if 500 <= response.status < 600:
                    msg = f"Backend unavailable (status {response.status})"
                    raise DaynestApiClientServerUnavailableError(msg)
                response.raise_for_status()

                result = await response.json(content_type=None)
                if not isinstance(result, dict):
                    msg = "Malformed response payload: expected JSON object"
                    raise DaynestApiClientMalformedResponseError(msg)
                return result

        except TimeoutError as err:
            msg = f"Request timed out for endpoint {path}"
            raise DaynestApiClientTimeoutError(msg) from err
        except aiohttp.ClientConnectionError as err:
            msg = f"Server unavailable while requesting endpoint {path}: {err}"
            raise DaynestApiClientServerUnavailableError(msg) from err
        except aiohttp.ClientError as err:
            msg = f"Communication error while requesting endpoint {path}: {err}"
            raise DaynestApiClientCommunicationError(msg) from err
        except ValueError as err:
            msg = f"Malformed JSON response for endpoint {path}: {err}"
            raise DaynestApiClientMalformedResponseError(msg) from err
