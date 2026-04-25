"""
Credential validators.

Validation functions for user credentials and authentication.

When this file grows, consider splitting into:
- credentials.py: Basic credential validation
- oauth.py: OAuth-specific validation
- api_auth.py: API authentication methods
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.daynest.api import DaynestApiClient
from homeassistant.helpers.aiohttp_client import async_get_clientsession

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


async def validate_credentials(hass: HomeAssistant, base_url: str, integration_key: str) -> None:
    """
    Validate user credentials by testing API connection.

    Args:
        hass: Home Assistant instance.
        base_url: The Daynest base URL to validate.
        integration_key: The Daynest integration key to validate.

    Raises:
        DaynestApiClientAuthenticationError: If credentials are invalid.
        DaynestApiClientCommunicationError: If communication fails.
        DaynestApiClientError: For other API errors.

    """
    client = DaynestApiClient(
        session=async_get_clientsession(hass),
        base_url=base_url,
        integration_key=integration_key,
    )
    await client.async_get_summary()  # May raise authentication/communication errors


__all__ = [
    "validate_credentials",
]
