"""Daynest async HTTP client."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import aiohttp


class DaynestClient:
    """Async client for the Daynest REST API."""

    def __init__(self, base_url: str, api_key: str, session: aiohttp.ClientSession | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._session = session
        self._owned_session = session is None

    async def __aenter__(self) -> DaynestClient:
        if self._owned_session:
            import aiohttp
            self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, *args: object) -> None:
        if self._owned_session and self._session is not None:
            await self._session.close()
            self._session = None
