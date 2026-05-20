"""Daynest async HTTP client."""

from __future__ import annotations

import logging
import inspect
import time
from collections.abc import Awaitable, Callable, Mapping
from datetime import date
from typing import Any, TypeVar
from urllib.parse import urljoin

import aiohttp

from daynest.exceptions import (
    DaynestAuthError,
    DaynestCommunicationError,
    DaynestMalformedResponseError,
    DaynestNotFoundError,
    DaynestServerUnavailableError,
    DaynestTimeoutError,
)
from daynest.models import DaynestApiResponse, DaynestDashboard, DaynestSummary

DEFAULT_API_BASE_URL = "http://localhost:8000"
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)
TOKEN_EXPIRY_BUFFER = 30  # seconds before expiry to refresh proactively

logger = logging.getLogger(__name__)

ModelT = TypeVar("ModelT")


class DaynestClient:
    """Async HTTP client for the Daynest API.

    Supports two usage patterns:

    Standalone (library owns the session)::

        async with DaynestClient(base_url, integration_key) as client:
            dashboard = await client.async_get_dashboard()

    HA-compatible (caller supplies a shared session)::

        client = DaynestClient(base_url, integration_key, session=hass_session)
        dashboard = await client.async_get_dashboard()
    """

    def __init__(
        self,
        base_url: str | None = None,
        integration_key: str | None = None,
        *,
        session: aiohttp.ClientSession | None = None,
        password: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        token_url: str | None = None,
        access_token_getter: Callable[[], str | None | Awaitable[str | None]] | None = None,
    ) -> None:
        if base_url is not None and not base_url.strip():
            msg = "A base URL is required to initialize DaynestClient"
            raise ValueError(msg)
        self._base_url = (base_url or DEFAULT_API_BASE_URL).strip().rstrip("/")
        self._integration_key = integration_key if integration_key is not None else password
        self._client_id = client_id
        self._client_secret = client_secret
        self._token_url = token_url
        self._access_token_getter = access_token_getter
        self._cached_token: str | None = None
        self._token_expires_at: float = 0.0
        self._session = session
        self._owned_session = session is None
        self._context_depth = 0

    async def __aenter__(self) -> DaynestClient:
        self._context_depth += 1
        if self._owned_session and self._session is None:
            self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, *args: object) -> None:
        self._context_depth -= 1
        if self._owned_session and self._context_depth == 0 and self._session is not None:
            await self._session.close()
            self._session = None

    @property
    def has_integration_key(self) -> bool:
        """Return whether the client has an integration key configured."""
        return bool(self._integration_key)

    @property
    def has_oauth_credentials(self) -> bool:
        """Return whether the client has OAuth client credentials configured."""
        return bool(self._client_id and self._client_secret and self._token_url)

    async def _get_external_access_token(self) -> str | None:
        """Return an externally managed OAuth access token, if configured."""
        if self._access_token_getter is None:
            return None
        token = self._access_token_getter()
        if inspect.isawaitable(token):
            token = await token
        if not token:
            return None
        return token

    async def _fetch_oauth_token(self) -> str:
        """Exchange client credentials for an access token."""
        session = self._session_or_raise()
        data = {
            "grant_type": "client_credentials",
            "client_id": self._client_id,
            "client_secret": self._client_secret,
        }
        try:
            async with session.post(
                self._token_url,  # type: ignore[arg-type]
                data=data,
                timeout=REQUEST_TIMEOUT,
            ) as response:
                if response.status in (401, 403):
                    msg = "OAuth client credentials rejected by token endpoint"
                    raise DaynestAuthError(msg)
                response.raise_for_status()
                try:
                    body = await response.json(content_type=None)
                    if not isinstance(body, Mapping):
                        msg = "Token endpoint response was not a JSON object"
                        raise ValueError(msg)
                    token = body.get("access_token")
                    if not isinstance(token, str) or not token:
                        msg = "Token endpoint returned no access_token"
                        raise ValueError(msg)
                    try:
                        expires_in = int(body.get("expires_in", 300))
                    except (TypeError, ValueError):
                        expires_in = 300
                except ValueError as err:
                    msg = f"Token endpoint returned malformed payload: {err}"
                    raise DaynestAuthError(msg) from err
                self._cached_token = token
                self._token_expires_at = time.monotonic() + expires_in - TOKEN_EXPIRY_BUFFER
                return token
        except aiohttp.ClientError as err:
            msg = f"Failed to reach token endpoint: {err}"
            raise DaynestCommunicationError(msg) from err

    async def _get_auth_headers(self) -> dict[str, str]:
        """Return auth headers for an API request."""
        if external_token := await self._get_external_access_token():
            return {"Authorization": f"Bearer {external_token}"}
        if self.has_oauth_credentials:
            if not self._cached_token or time.monotonic() >= self._token_expires_at:
                await self._fetch_oauth_token()
            return {"Authorization": f"Bearer {self._cached_token}"}
        if self._integration_key:
            return {"X-Integration-Key": self._integration_key}
        return {}

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
        """Complete a chore instance by ID."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/complete-task",
            payload={"chore_instance_id": chore_instance_id},
        )

    async def async_snooze_task(self, chore_instance_id: int, days: int = 1) -> dict[str, Any]:
        """Reschedule a chore instance N days into the future."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/snooze-task",
            payload={"chore_instance_id": chore_instance_id, "days": days},
        )

    async def async_mark_medication_taken(self, medication_dose_id: int) -> dict[str, Any]:
        """Mark a medication dose as taken."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/mark-medication-taken",
            payload={"medication_dose_id": medication_dose_id},
        )

    async def async_skip_task(self, chore_instance_id: int) -> dict[str, Any]:
        """Skip a chore instance."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/skip-task",
            payload={"chore_instance_id": chore_instance_id},
        )

    async def async_skip_medication(self, medication_dose_id: int) -> dict[str, Any]:
        """Skip a medication dose."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/skip-medication",
            payload={"medication_dose_id": medication_dose_id},
        )

    async def async_mark_planned_done(self, planned_item_id: int) -> dict[str, Any]:
        """Mark a planned item as done."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/mark-planned-done",
            payload={"planned_item_id": planned_item_id},
        )

    async def async_create_planned_item(
        self,
        *,
        title: str,
        planned_for: str,
        notes: str | None = None,
    ) -> dict[str, Any]:
        """Create a planned item."""
        return await self._post_action(
            path="/api/v1/integrations/home-assistant/actions/create-planned-item",
            payload={"title": title, "planned_for": planned_for, "notes": notes},
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
        """Update a planned item."""
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
        """Delete a planned item."""
        return await self._delete_action(
            path=f"/api/v1/integrations/home-assistant/actions/delete-planned-item/{planned_item_id}",
        )

    async def async_get_calendar(self, start: date, end: date) -> list[dict[str, Any]]:
        """Fetch calendar events for an inclusive date range."""
        return await self._request_list(
            f"/api/v1/integrations/home-assistant/calendar?start={start.isoformat()}&end={end.isoformat()}"
        )

    def _session_or_raise(self) -> aiohttp.ClientSession:
        if self._session is None:
            msg = "No active session — use 'async with DaynestClient(...) as client' or supply a session"
            raise RuntimeError(msg)
        return self._session

    @staticmethod
    def _check_response_status(response: aiohttp.ClientResponse, path: str) -> None:
        if response.status in (401, 403):
            msg = f"Authentication failed with status {response.status}"
            raise DaynestAuthError(msg)
        if response.status == 404:
            msg = f"Resource not found at {path}"
            raise DaynestNotFoundError(msg)
        if 500 <= response.status < 600:
            msg = f"Backend unavailable (status {response.status})"
            raise DaynestServerUnavailableError(msg)
        response.raise_for_status()

    async def _request_model(
        self,
        path: str,
        parser: Callable[[dict[str, Any]], ModelT],
    ) -> DaynestApiResponse[ModelT]:
        session = self._session_or_raise()
        url = urljoin(f"{self._base_url}/", path.lstrip("/"))
        headers = {"Accept": "application/json", **await self._get_auth_headers()}

        try:
            async with session.get(url, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                self._check_response_status(response, path)

                contract = response.headers.get("X-Integration-Contract")
                payload = await response.json(content_type=None)
                if not isinstance(payload, dict):
                    msg = "Malformed response payload: expected JSON object"
                    raise DaynestMalformedResponseError(msg)

                model = parser(payload)
                return DaynestApiResponse(data=model, integration_contract=contract)

        except TimeoutError as err:
            msg = f"Request timed out for endpoint {path}"
            raise DaynestTimeoutError(msg) from err
        except aiohttp.ClientConnectionError as err:
            msg = f"Server unavailable while requesting endpoint {path}: {err}"
            raise DaynestServerUnavailableError(msg) from err
        except aiohttp.ClientError as err:
            msg = f"Communication error while requesting endpoint {path}: {err}"
            raise DaynestCommunicationError(msg) from err
        except ValueError as err:
            msg = f"Malformed JSON response for endpoint {path}: {err}"
            raise DaynestMalformedResponseError(msg) from err

    async def _request_list(self, path: str) -> list[dict[str, Any]]:
        session = self._session_or_raise()
        url = urljoin(f"{self._base_url}/", path.lstrip("/"))
        headers = {"Accept": "application/json", **await self._get_auth_headers()}

        try:
            async with session.get(url, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                self._check_response_status(response, path)

                payload = await response.json(content_type=None)
                if not isinstance(payload, list):
                    msg = "Malformed response payload: expected JSON array"
                    raise DaynestMalformedResponseError(msg)
                result = []
                for i, item in enumerate(payload):
                    if isinstance(item, dict):
                        result.append(item)
                    else:
                        logger.warning("Skipping non-dict item at index %d in response for %s: %r", i, path, item)
                return result

        except TimeoutError as err:
            msg = f"Request timed out for endpoint {path}"
            raise DaynestTimeoutError(msg) from err
        except aiohttp.ClientConnectionError as err:
            msg = f"Server unavailable while requesting endpoint {path}: {err}"
            raise DaynestServerUnavailableError(msg) from err
        except aiohttp.ClientError as err:
            msg = f"Communication error while requesting endpoint {path}: {err}"
            raise DaynestCommunicationError(msg) from err
        except ValueError as err:
            msg = f"Malformed JSON response for endpoint {path}: {err}"
            raise DaynestMalformedResponseError(msg) from err

    async def _post_action(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._send_action("post", path=path, payload=payload)

    async def _put_action(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._send_action("put", path=path, payload=payload)

    async def _delete_action(self, path: str) -> dict[str, Any]:
        return await self._send_action("delete", path=path)

    async def _send_action(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        session = self._session_or_raise()
        url = urljoin(f"{self._base_url}/", path.lstrip("/"))
        headers = {"Accept": "application/json", **await self._get_auth_headers()}
        if payload is not None:
            headers["Content-Type"] = "application/json"

        if method.lower() not in {"post", "put", "delete"}:
            msg = f"Unsupported write method: {method}"
            raise ValueError(msg)

        request = getattr(session, method.lower())
        request_kwargs: dict[str, Any] = {"headers": headers, "timeout": REQUEST_TIMEOUT}
        if payload is not None:
            request_kwargs["json"] = payload

        try:
            async with request(url, **request_kwargs) as response:
                self._check_response_status(response, path)

                result = await response.json(content_type=None)
                if not isinstance(result, dict):
                    msg = "Malformed response payload: expected JSON object"
                    raise DaynestMalformedResponseError(msg)
                return result

        except TimeoutError as err:
            msg = f"Request timed out for endpoint {path}"
            raise DaynestTimeoutError(msg) from err
        except aiohttp.ClientConnectionError as err:
            msg = f"Server unavailable while requesting endpoint {path}: {err}"
            raise DaynestServerUnavailableError(msg) from err
        except aiohttp.ClientError as err:
            msg = f"Communication error while requesting endpoint {path}: {err}"
            raise DaynestCommunicationError(msg) from err
        except ValueError as err:
            msg = f"Malformed JSON response for endpoint {path}: {err}"
            raise DaynestMalformedResponseError(msg) from err
