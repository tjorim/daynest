"""HTTP API client for Daynest backend integration endpoints."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from collections.abc import Callable
from typing import Any, Generic, TypeVar
from urllib.parse import urljoin

import aiohttp

from ..const import DEFAULT_API_BASE_URL


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

    user_id: int
    record_id: int
    title: str
    body: str

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> DaynestSummary:
        """Build a typed summary model from raw JSON payload."""
        try:
            user_id = int(payload["userId"])
            record_id = int(payload["id"])
            title = str(payload["title"])
            body = str(payload["body"])
        except (KeyError, TypeError, ValueError) as err:
            msg = f"Malformed summary payload: {err}"
            raise DaynestApiClientMalformedResponseError(msg) from err

        return cls(user_id=user_id, record_id=record_id, title=title, body=body)


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
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        """Initialize client with optional backward-compatible parameter aliases."""
        resolved_base_url = (base_url or DEFAULT_API_BASE_URL).strip().rstrip("/")
        if not resolved_base_url:
            msg = "A base URL is required to initialize DaynestApiClient"
            raise ValueError(msg)

        self._session = session
        self._base_url = resolved_base_url
        self._integration_key = integration_key or password

        self.last_integration_contract: str | None = None

    @property
    def has_integration_key(self) -> bool:
        """Return whether the client has an integration key configured."""
        return bool(self._integration_key)

    async def async_get_data(self) -> dict[str, Any]:
        """Fetch summary data as the coordinator's primary payload."""
        response = await self.async_get_summary()
        return {
            "userId": response.data.user_id,
            "id": response.data.record_id,
            "title": response.data.title,
            "body": response.data.body,
        }

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
            async with self._session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status in (401, 403):
                    msg = f"Authentication failed with status {response.status}"
                    raise DaynestApiClientAuthenticationError(msg)
                if response.status in (502, 503, 504):
                    msg = f"Backend unavailable (status {response.status})"
                    raise DaynestApiClientServerUnavailableError(msg)
                response.raise_for_status()

                contract = response.headers.get("X-Integration-Contract")
                self.last_integration_contract = contract

                payload = await response.json(content_type=None)
                if not isinstance(payload, dict):
                    msg = "Malformed response payload: expected JSON object"
                    raise DaynestApiClientMalformedResponseError(msg)

                model = parser(payload)
                return DaynestApiResponse(data=model, integration_contract=contract)

        except asyncio.TimeoutError as err:
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
