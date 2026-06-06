"""Daynest async HTTP client."""

from __future__ import annotations

import logging
import json
import inspect
import asyncio
import copy
import time
import weakref
from collections.abc import Awaitable, Callable, Mapping
from datetime import date, timedelta
from typing import Any, TypeVar
from urllib.parse import urlencode, urljoin

import aiohttp

from daynest.exceptions import (
    DaynestAuthError,
    DaynestCommunicationError,
    DaynestMalformedResponseError,
    DaynestNotFoundError,
    DaynestServerUnavailableError,
    DaynestTimeoutError,
)
from daynest.models import (
    CalendarDay,
    CalendarEvent,
    ChoreTemplate,
    DaynestApiResponse,
    DaynestDashboard,
    DaynestSummary,
    PlannedItem,
    RoutineTemplate,
)

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
        cache_ttl: int = 0,
        enable_sse: bool = True,
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
        self._cache_auth_identity = self._make_cache_auth_identity()
        self._cached_token: str | None = None
        self._token_expires_at: float = 0.0
        self._session = session
        self._owned_session = session is None
        self._context_depth = 0
        self._cache_ttl = max(0, int(cache_ttl))
        self._cache: dict[str, tuple[Any, float]] = {}
        self._cache_locks: weakref.WeakValueDictionary[str, asyncio.Lock] = weakref.WeakValueDictionary()
        self._cache_locks_guard = asyncio.Lock()
        self._enable_sse = enable_sse
        self._background_tasks: set[asyncio.Task[Any]] = set()

    async def __aenter__(self) -> DaynestClient:
        self._context_depth += 1
        if self._owned_session and self._session is None:
            self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, *args: object) -> None:
        self._context_depth -= 1
        if self._context_depth == 0:
            await self._cancel_background_tasks()
            if self._owned_session and self._session is not None:
                await self._session.close()
                self._session = None

    async def _cancel_background_tasks(self) -> None:
        tasks = tuple(self._background_tasks)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

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

    @classmethod
    async def async_fetch_oidc_config(
        cls,
        base_url: str,
        *,
        session: aiohttp.ClientSession | None = None,
    ) -> tuple[str, str] | None:
        """Fetch OIDC discovery endpoints from the Daynest backend.

        Returns (authorization_url, token_url) or None if the backend is
        unreachable or the response is malformed. Does not require authentication.
        """
        url = urljoin(f"{base_url.strip().rstrip('/')}/", "api/auth/oidc-config")
        owned = session is None
        if owned:
            session = aiohttp.ClientSession()
        try:
            async with session.get(url, timeout=REQUEST_TIMEOUT) as resp:
                if resp.status == 200:
                    data = await resp.json(content_type=None)
                    if isinstance(data, dict):
                        auth_url = data.get("authorization_url")
                        token_url = data.get("token_url")
                        if isinstance(auth_url, str) and isinstance(token_url, str):
                            return auth_url, token_url
        except Exception:  # noqa: BLE001
            pass
        finally:
            if owned:
                await session.close()
        return None

    async def async_get_data(self) -> dict[str, Any]:
        """Fetch summary data as the coordinator's primary payload."""
        response = await self.async_get_summary()
        return response.data.payload

    async def async_get_summary(self) -> DaynestApiResponse[DaynestSummary]:
        """Fetch and parse the integration summary endpoint."""
        return await self._cached_call(
            "async_get_summary",
            lambda: self._request_model(
                path="/api/integrations/home-assistant/summary",
                parser=DaynestSummary.from_dict,
            ),
        )

    async def async_get_dashboard(self) -> DaynestApiResponse[DaynestDashboard]:
        """Fetch and parse the integration dashboard endpoint."""
        return await self._cached_call(
            "async_get_dashboard",
            lambda: self._request_model(
                path="/api/integrations/home-assistant/dashboard",
                parser=DaynestDashboard.from_dict,
            ),
        )

    async def async_get_user_settings(self) -> dict[str, Any]:
        """Fetch user settings for the authenticated integration user."""
        return await self._cached_call("async_get_user_settings", lambda: self._request_dict("/api/users/me/settings"))

    async def async_update_user_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Patch user settings for the authenticated integration user."""
        return await self._send_action("patch", path="/api/users/me/settings", payload=payload)

    async def async_complete_task(self, chore_instance_id: int) -> dict[str, Any]:
        """Complete a chore instance by ID."""
        return await self._post_action(
            path="/api/integrations/home-assistant/actions/complete-task",
            payload={"chore_instance_id": chore_instance_id},
        )

    async def async_snooze_task(self, chore_instance_id: int, days: int = 1) -> dict[str, Any]:
        """Reschedule a chore instance N days into the future."""
        return await self._post_action(
            path="/api/integrations/home-assistant/actions/snooze-task",
            payload={"chore_instance_id": chore_instance_id, "days": days},
        )

    async def async_mark_medication_taken(self, medication_dose_id: int) -> dict[str, Any]:
        """Mark a medication dose as taken."""
        return await self._post_action(
            path="/api/integrations/home-assistant/actions/mark-medication-taken",
            payload={"medication_dose_id": medication_dose_id},
        )

    async def async_skip_task(self, chore_instance_id: int) -> dict[str, Any]:
        """Skip a chore instance."""
        return await self._post_action(
            path="/api/integrations/home-assistant/actions/skip-task",
            payload={"chore_instance_id": chore_instance_id},
        )

    async def async_skip_medication(self, medication_dose_id: int) -> dict[str, Any]:
        """Skip a medication dose."""
        return await self._post_action(
            path="/api/integrations/home-assistant/actions/skip-medication",
            payload={"medication_dose_id": medication_dose_id},
        )

    async def async_mark_planned_done(self, planned_item_id: int) -> dict[str, Any]:
        """Mark a planned item as done."""
        return await self._post_action(
            path="/api/integrations/home-assistant/actions/mark-planned-done",
            payload={"planned_item_id": planned_item_id},
        )

    async def async_list_planned_items(
        self,
        date_from: date,
        date_to: date,
    ) -> list[PlannedItem]:
        """List planned items in a date range."""
        query = urlencode({"start_date": date_from.isoformat(), "end_date": date_to.isoformat()})
        payload = await self._cached_call(
            "async_list_planned_items",
            lambda: self._request_list(f"/api/planned-items?{query}"),
            date_from.isoformat(),
            date_to.isoformat(),
        )
        return [PlannedItem.from_dict(item) for item in payload]

    async def async_create_planned_item(
        self,
        title: str,
        planned_for: date | str,
        *,
        notes: str | None = None,
        priority: str = "normal",
        tags: list[str] | None = None,
        rrule: str | None = None,
    ) -> PlannedItem:
        """Create a planned item."""
        payload: dict[str, Any] = {
            "title": title,
            "planned_for": planned_for.isoformat() if isinstance(planned_for, date) else planned_for,
            "notes": notes,
            "priority": priority,
            "tags": tags or [],
            "rrule": rrule,
        }
        result = await self._send_action("post", path="/api/planned-items", payload=payload)
        return PlannedItem.from_dict(result)

    async def async_update_planned_item(
        self,
        item_id: int | None = None,
        *,
        scope: str = "this",
        **fields: Any,
    ) -> PlannedItem:
        """Update a planned item.

        scope: "this" (default), "future", or "all" — controls which items in a
        recurring series are updated. Non-recurring items ignore this parameter.
        """
        payload_fields = dict(fields)
        resolved_item_id = item_id
        if resolved_item_id is None:
            legacy_id = payload_fields.pop("planned_item_id", None)
            if isinstance(legacy_id, int):
                resolved_item_id = legacy_id
        if resolved_item_id is None:
            msg = "item_id is required"
            raise ValueError(msg)
        if "planned_for" in payload_fields and isinstance(payload_fields["planned_for"], date):
            payload_fields["planned_for"] = payload_fields["planned_for"].isoformat()
        path = f"/api/planned-items/{resolved_item_id}"
        if scope != "this":
            path += f"?scope={scope}"
        result = await self._send_action("put", path=path, payload=payload_fields)
        return PlannedItem.from_dict(result)

    async def async_delete_planned_item(
        self,
        item_id: int | None = None,
        *,
        planned_item_id: int | None = None,
        scope: str = "this",
    ) -> None:
        """Delete a planned item.

        scope: "this" (default) or "future" — controls which items in a recurring
        series are deleted. Non-recurring items ignore this parameter.
        """
        resolved_item_id = item_id if item_id is not None else planned_item_id
        if resolved_item_id is None:
            msg = "item_id is required"
            raise ValueError(msg)
        path = f"/api/planned-items/{resolved_item_id}"
        if scope != "this":
            path += f"?scope={scope}"
        await self._send_no_content_action("delete", path=path)


    async def async_list_shopping_lists(self, status: str = "active") -> list[dict[str, Any]]:
        """List shopping lists for the authenticated user."""
        query = urlencode({"status": status})
        return await self._cached_call(
            "async_list_shopping_lists",
            lambda: self._request_list(f"/api/shopping-lists?{query}"),
            status,
        )

    async def async_list_shopping_items(self, shopping_list_id: int) -> list[dict[str, Any]]:
        """List planned items linked to a shopping list."""
        payload = await self._cached_call(
            "async_list_shopping_items",
            lambda: self._request_list("/api/planned-items"),
        )
        return [
            item
            for item in payload
            if item.get("module_key") == "shopping_list"
            and str(item.get("linked_ref", "")) == str(shopping_list_id)
        ]

    async def async_create_shopping_item(
        self,
        shopping_list_id: int,
        *,
        title: str,
        planned_for: date | str,
        notes: str | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create an item linked to a shopping list."""
        payload = {
            "title": title,
            "planned_for": planned_for.isoformat() if isinstance(planned_for, date) else planned_for,
            "notes": notes,
            "module_key": "shopping_list",
            "linked_source": "shopping_list",
            "linked_ref": str(shopping_list_id),
            "priority": "normal",
            "tags": tags or [],
        }
        return await self._send_action("post", path="/api/planned-items", payload=payload)

    async def async_update_shopping_item(
        self,
        shopping_list_id: int,
        item_id: int,
        *,
        title: str,
        planned_for: date | str,
        is_done: bool,
        notes: str | None = None,
        tags: list[str] | None = None,
        priority: str = "normal",
    ) -> dict[str, Any]:
        """Update an item linked to a shopping list."""
        payload = {
            "title": title,
            "planned_for": planned_for.isoformat() if isinstance(planned_for, date) else planned_for,
            "notes": notes,
            "module_key": "shopping_list",
            "linked_source": "shopping_list",
            "linked_ref": str(shopping_list_id),
            "priority": priority,
            "tags": tags or [],
            "is_done": is_done,
        }
        return await self._send_action("put", path=f"/api/planned-items/{item_id}", payload=payload)

    async def async_delete_shopping_item(self, item_id: int) -> None:
        """Delete an item linked to a shopping list."""
        await self._send_no_content_action("delete", path=f"/api/planned-items/{item_id}")

    async def async_get_calendar(
        self,
        start: date,
        end: date,
        event_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch calendar events for an inclusive date range."""
        params = {
            "start": start.isoformat(),
            "end": end.isoformat(),
        }
        if event_type is not None:
            params["event_type"] = event_type
        encoded_params = urlencode(params)
        return await self._cached_call(
            "async_get_calendar",
            lambda: self._request_list(f"/api/integrations/home-assistant/calendar?{encoded_params}"),
            start.isoformat(),
            end.isoformat(),
            event_type or "",
        )

    async def async_list_routine_templates(self) -> list[RoutineTemplate]:
        """List routine templates."""
        payload = await self._cached_call("async_list_routine_templates", lambda: self._request_list("/api/templates/routines"))
        return [RoutineTemplate.from_dict(item) for item in payload]

    async def async_create_routine_template(
        self,
        name: str,
        every_n_days: int,
        start_date: date,
        *,
        description: str | None = None,
        rrule: str | None = None,
        due_time: str | None = None,
        is_active: bool = True,
    ) -> RoutineTemplate:
        """Create a routine template."""
        result = await self._send_action(
            "post",
            path="/api/templates/routines",
            payload={
                "name": name,
                "every_n_days": every_n_days,
                "start_date": start_date.isoformat(),
                "description": description,
                "rrule": rrule,
                "due_time": due_time,
                "is_active": is_active,
            },
        )
        return RoutineTemplate.from_dict(result)

    async def async_update_routine_template(self, template_id: int, **fields: Any) -> RoutineTemplate:
        """Update a routine template."""
        payload_fields = dict(fields)
        if "start_date" in payload_fields and isinstance(payload_fields["start_date"], date):
            payload_fields["start_date"] = payload_fields["start_date"].isoformat()
        result = await self._send_action("put", path=f"/api/templates/routines/{template_id}", payload=payload_fields)
        return RoutineTemplate.from_dict(result)

    async def async_delete_routine_template(self, template_id: int) -> None:
        """Delete a routine template."""
        await self._send_no_content_action("delete", path=f"/api/templates/routines/{template_id}")

    async def async_list_chore_templates(self, *, tags: list[str] | None = None) -> list[ChoreTemplate]:
        """List chore templates."""
        query = f"?{urlencode({'tags': ','.join(tags)})}" if tags else ""
        payload = await self._cached_call(
            "async_list_chore_templates",
            lambda: self._request_list(f"/api/templates/chores{query}"),
            ",".join(tags or []),
        )
        return [ChoreTemplate.from_dict(item) for item in payload]

    async def async_create_chore_template(
        self,
        name: str,
        every_n_days: int,
        start_date: date,
        *,
        description: str | None = None,
        rrule: str | None = None,
        priority: str = "normal",
        tags: list[str] | None = None,
        is_active: bool = True,
    ) -> ChoreTemplate:
        """Create a chore template."""
        result = await self._send_action(
            "post",
            path="/api/templates/chores",
            payload={
                "name": name,
                "every_n_days": every_n_days,
                "start_date": start_date.isoformat(),
                "description": description,
                "rrule": rrule,
                "priority": priority,
                "tags": tags or [],
                "is_active": is_active,
            },
        )
        return ChoreTemplate.from_dict(result)

    async def async_update_chore_template(self, template_id: int, **fields: Any) -> ChoreTemplate:
        """Update a chore template."""
        payload_fields = dict(fields)
        if "start_date" in payload_fields and isinstance(payload_fields["start_date"], date):
            payload_fields["start_date"] = payload_fields["start_date"].isoformat()
        result = await self._send_action("put", path=f"/api/templates/chores/{template_id}", payload=payload_fields)
        return ChoreTemplate.from_dict(result)

    async def async_delete_chore_template(self, template_id: int) -> None:
        """Delete a chore template."""
        await self._send_no_content_action("delete", path=f"/api/templates/chores/{template_id}")

    async def async_get_calendar_month(self, year: int, month: int) -> list[CalendarDay]:
        """Fetch calendar month summaries."""
        payload = await self._cached_call(
            "async_get_calendar_month",
            lambda: self._request_dict(f"/api/calendar/month?{urlencode({'year': year, 'month': month})}"),
            year,
            month,
        )
        days_payload = payload.get("days")
        if not isinstance(days_payload, list):
            msg = "Malformed response payload: expected days array"
            raise DaynestMalformedResponseError(msg)
        return [CalendarDay.from_month_summary_dict(day) for day in days_payload if isinstance(day, dict)]

    async def async_get_calendar_day(self, target_date: date) -> CalendarDay:
        """Fetch calendar day details."""
        payload = await self._cached_call(
            "async_get_calendar_day",
            lambda: self._request_dict(f"/api/calendar/day?{urlencode({'date': target_date.isoformat()})}"),
            target_date.isoformat(),
        )
        return CalendarDay.from_day_dict(payload)

    async def async_get_calendar_range(self, start: date, end: date) -> list[CalendarEvent]:
        """Fetch typed calendar day items for an inclusive date range."""
        if end < start:
            msg = "end must be on or after start"
            raise ValueError(msg)
        days = await asyncio.gather(
            *(self.async_get_calendar_day(start + timedelta(days=offset)) for offset in range((end - start).days + 1))
        )
        return [event for day in days for event in day.items]

    async def async_export_calendar_ics(self) -> bytes:
        """Export calendar iCalendar bytes."""
        return await self._cached_call("async_export_calendar_ics", lambda: self._request_bytes("/api/calendar/export.ics"))

    async def async_listen(
        self,
        callback: Callable[[str, dict[str, Any]], Awaitable[None]],
    ) -> Callable[[], None]:
        """Subscribe to SSE updates and return an unsubscribe callable."""
        if not self._enable_sse:
            return lambda: None

        session = self._session_or_raise()
        stop_event = asyncio.Event()

        async def _listen() -> None:
            backoff_seconds = 1.0
            while not stop_event.is_set():
                token = await self._get_stream_token()
                if token is None:
                    logger.warning("Cannot subscribe to updates: no authentication configured")
                    return
                url = urljoin(
                    f"{self._base_url}/",
                    f"/api/today/stream?{urlencode({'token': token})}",
                )
                try:
                    async with session.get(
                        url,
                        headers={"Accept": "text/event-stream"},
                        timeout=None,
                    ) as response:
                        self._check_response_status(response, "/api/today/stream")
                        backoff_seconds = 1.0
                        event_name = "message"
                        data_lines: list[str] = []
                        async for raw_line in response.content:
                            if stop_event.is_set():
                                return
                            line = raw_line.decode("utf-8").strip()
                            if not line:
                                payload: dict[str, Any]
                                try:
                                    payload = json.loads("\n".join(data_lines)) if data_lines else {}
                                except ValueError:
                                    payload = {}
                                try:
                                    await callback(event_name, payload)
                                except Exception:  # noqa: BLE001
                                    logger.exception(
                                        "SSE callback failed for event %s with payload %r",
                                        event_name,
                                        payload,
                                    )
                                event_name = "message"
                                data_lines = []
                                continue
                            if line.startswith("event:"):
                                event_name = line.partition(":")[2].strip() or "message"
                            elif line.startswith("data:"):
                                data_lines.append(line.partition(":")[2].lstrip())
                except asyncio.CancelledError:
                    raise
                except Exception as err:  # noqa: BLE001
                    logger.debug("SSE today stream reconnecting after error: %s", err)
                await asyncio.sleep(backoff_seconds)
                backoff_seconds = min(backoff_seconds * 2, 30.0)

        listener_task = asyncio.create_task(_listen(), name="daynest_sse_listener")
        self._background_tasks.add(listener_task)
        listener_task.add_done_callback(self._background_tasks.discard)

        def _unsubscribe() -> None:
            stop_event.set()
            listener_task.cancel()

        return _unsubscribe

    async def async_subscribe_today_updates(
        self,
        callback: Callable[[dict[str, Any]], Awaitable[None]],
    ) -> Callable[[], None]:
        """Subscribe to today SSE updates and return an unsubscribe callable."""
        async def _today_callback(event_name: str, payload: dict[str, Any]) -> None:
            if event_name == "today_updated":
                await callback(payload)

        return await self.async_listen(_today_callback)

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

    def _make_cache_auth_identity(self) -> str:
        if self._access_token_getter is not None:
            return "external"
        if self._client_id and self._token_url:
            return f"oauth:{self._client_id}:{self._token_url}"
        if self._integration_key:
            return "integration-key"
        return "anonymous"

    def _make_cache_key(self, method_name: str, args: tuple[Any, ...]) -> str:
        serialized = json.dumps(args, sort_keys=True, default=str)
        return f"{self._cache_auth_identity}:{method_name}:{serialized}"

    async def _get_cache_lock(self, cache_key: str) -> asyncio.Lock:
        async with self._cache_locks_guard:
            lock = self._cache_locks.get(cache_key)
            if lock is None:
                lock = asyncio.Lock()
                self._cache_locks[cache_key] = lock
            return lock

    async def _cached_call(
        self,
        method_name: str,
        call: Callable[[], Awaitable[ModelT]],
        *cache_args: Any,
    ) -> ModelT:
        if self._cache_ttl <= 0:
            return await call()
        cache_key = self._make_cache_key(method_name, cache_args)
        now = time.monotonic()
        cached = self._cache.get(cache_key)
        if cached is not None and cached[1] > now:
            return copy.deepcopy(cached[0])
        lock = await self._get_cache_lock(cache_key)
        async with lock:
            cached = self._cache.get(cache_key)
            now = time.monotonic()
            if cached is not None and cached[1] > now:
                return copy.deepcopy(cached[0])
            result = await call()
            self._cache[cache_key] = (copy.deepcopy(result), now + self._cache_ttl)
            return result

    def _clear_cache(self) -> None:
        if self._cache_ttl <= 0:
            return
        self._cache.clear()

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

    async def _request_dict(self, path: str) -> dict[str, Any]:
        session = self._session_or_raise()
        url = urljoin(f"{self._base_url}/", path.lstrip("/"))
        headers = {"Accept": "application/json", **await self._get_auth_headers()}

        try:
            async with session.get(url, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                self._check_response_status(response, path)
                payload = await response.json(content_type=None)
                if not isinstance(payload, dict):
                    msg = "Malformed response payload: expected JSON object"
                    raise DaynestMalformedResponseError(msg)
                return payload

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

    async def _request_bytes(self, path: str) -> bytes:
        session = self._session_or_raise()
        url = urljoin(f"{self._base_url}/", path.lstrip("/"))
        headers = {"Accept": "text/calendar,application/octet-stream", **await self._get_auth_headers()}
        try:
            async with session.get(url, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                self._check_response_status(response, path)
                return await response.read()
        except TimeoutError as err:
            msg = f"Request timed out for endpoint {path}"
            raise DaynestTimeoutError(msg) from err
        except aiohttp.ClientConnectionError as err:
            msg = f"Server unavailable while requesting endpoint {path}: {err}"
            raise DaynestServerUnavailableError(msg) from err
        except aiohttp.ClientError as err:
            msg = f"Communication error while requesting endpoint {path}: {err}"
            raise DaynestCommunicationError(msg) from err

    async def _post_action(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._send_action("post", path=path, payload=payload)

    async def _put_action(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._send_action("put", path=path, payload=payload)

    async def _delete_action(self, path: str) -> dict[str, Any]:
        return await self._send_action("delete", path=path)

    async def _send_no_content_action(
        self,
        method: str,
        path: str,
    ) -> None:
        session = self._session_or_raise()
        url = urljoin(f"{self._base_url}/", path.lstrip("/"))
        headers = {"Accept": "application/json", **await self._get_auth_headers()}
        request = getattr(session, method.lower())
        try:
            async with request(url, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                self._check_response_status(response, path)
                self._clear_cache()
        except TimeoutError as err:
            msg = f"Request timed out for endpoint {path}"
            raise DaynestTimeoutError(msg) from err
        except aiohttp.ClientConnectionError as err:
            msg = f"Server unavailable while requesting endpoint {path}: {err}"
            raise DaynestServerUnavailableError(msg) from err
        except aiohttp.ClientError as err:
            msg = f"Communication error while requesting endpoint {path}: {err}"
            raise DaynestCommunicationError(msg) from err

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

        if method.lower() not in {"post", "put", "patch", "delete"}:
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
                self._clear_cache()
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

    async def _get_stream_token(self) -> str | None:
        external = await self._get_external_access_token()
        if external:
            return external
        if self.has_oauth_credentials:
            if not self._cached_token or time.monotonic() >= self._token_expires_at:
                await self._fetch_oauth_token()
            return self._cached_token
        return self._integration_key
