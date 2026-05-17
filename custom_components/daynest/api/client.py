"""HTTP API client for Daynest backend integration endpoints."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
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
            "sensor_daynest_chores_due",
            "sensor_daynest_routines_open",
            "sensor_daynest_medication_due",
            "sensor_daynest_planned_remaining",
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

    async def async_complete_task(self, chore_instance_id: int) -> dict[str, Any]:
        """Complete a chore instance by ID via the HA write endpoint."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/complete-task",
            payload={"chore_instance_id": chore_instance_id},
        )

    async def async_snooze_task(self, chore_instance_id: int, days: int = 1) -> dict[str, Any]:
        """Reschedule a chore instance N days into the future via the HA write endpoint."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/snooze-task",
            payload={"chore_instance_id": chore_instance_id, "days": days},
        )

    async def async_mark_medication_taken(self, medication_dose_id: int) -> dict[str, Any]:
        """Mark a medication dose as taken via the HA write endpoint."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/mark-medication-taken",
            payload={"medication_dose_id": medication_dose_id},
        )

    async def async_skip_task(self, chore_instance_id: int) -> dict[str, Any]:
        """Skip a chore instance via the HA write endpoint."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/skip-task",
            payload={"chore_instance_id": chore_instance_id},
        )

    async def async_skip_medication(self, medication_dose_id: int) -> dict[str, Any]:
        """Skip a medication dose via the HA write endpoint."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/skip-medication",
            payload={"medication_dose_id": medication_dose_id},
        )

    async def async_create_planned_item(
        self,
        *,
        title: str,
        planned_for: str,
        notes: str | None = None,
    ) -> dict[str, Any]:
        """Create a planned item via the HA write endpoint."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/create-planned-item",
            payload={
                "title": title,
                "planned_for": planned_for,
                "notes": notes,
            },
        )

    async def async_update_planned_item(
        self,
        *,
        planned_item_id: int,
        title: str,
        planned_for: str,
        is_done: bool,
        notes: str | None = None,
        module_key: str | None = None,
        recurrence_hint: str | None = None,
        linked_source: str | None = None,
        linked_ref: str | None = None,
    ) -> dict[str, Any]:
        """Update a planned item via the HA write endpoint."""
        return await self._put_action(
            path=f"/api/v1/integrations/home-assistant/actions/update-planned-item/{planned_item_id}",
            payload={
                "title": title,
                "planned_for": planned_for,
                "is_done": is_done,
                "notes": notes,
                "module_key": module_key,
                "recurrence_hint": recurrence_hint,
                "linked_source": linked_source,
                "linked_ref": linked_ref,
            },
        )

    async def async_delete_planned_item(self, planned_item_id: int) -> dict[str, Any]:
        """Delete a planned item via the HA write endpoint."""
        return await self._delete_action(
            path=f"/api/v1/integrations/home-assistant/actions/delete-planned-item/{planned_item_id}",
        )

    async def async_get_calendar(self, start: date, end: date) -> list[dict[str, Any]]:
        """Fetch calendar events for an inclusive date range."""
        return await self._request_list(
            f"/api/v1/integrations/home-assistant/calendar?start={start.isoformat()}&end={end.isoformat()}"
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

    async def _request_list(self, path: str) -> list[dict[str, Any]]:
        """GET a list-returning endpoint and return the parsed items."""
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

                payload = await response.json(content_type=None)
                if not isinstance(payload, list):
                    msg = "Malformed response payload: expected JSON array"
                    raise DaynestApiClientMalformedResponseError(msg)
                return [item for item in payload if isinstance(item, dict)]

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
        return await self._send_action("post", path=path, payload=payload)

    async def _put_action(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        """PUT to a write endpoint and return the JSON response body."""
        return await self._send_action("put", path=path, payload=payload)

    async def _delete_action(self, path: str) -> dict[str, Any]:
        """DELETE to a write endpoint and return the JSON response body."""
        return await self._send_action("delete", path=path)

    async def _send_action(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Send write action and return the JSON response body."""
        url = urljoin(f"{self._base_url}/", path.lstrip("/"))
        headers = {"Accept": "application/json"}
        if payload is not None:
            headers["Content-Type"] = "application/json"
        if self._integration_key:
            headers["X-Integration-Key"] = self._integration_key

        if method.lower() not in {"post", "put", "delete"}:
            msg = f"Unsupported write method: {method}"
            raise ValueError(msg)

        request = getattr(self._session, method.lower())
        request_kwargs: dict[str, Any] = {
            "headers": headers,
            "timeout": REQUEST_TIMEOUT,
        }
        if payload is not None:
            request_kwargs["json"] = payload

        try:
            async with request(url, **request_kwargs) as response:
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
