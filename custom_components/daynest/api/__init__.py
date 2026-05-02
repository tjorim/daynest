"""
API package for daynest.

Architecture:
    Three-layer data flow: Entities → Coordinator → API Client.
    Only the coordinator should call the API client. Entities must never
    import or call the API client directly.

Exception hierarchy:
    DaynestApiClientError (base)
    ├── DaynestApiClientCommunicationError
    │   ├── DaynestApiClientTimeoutError
    │   └── DaynestApiClientServerUnavailableError
    ├── DaynestApiClientMalformedResponseError
    └── DaynestApiClientAuthenticationError

Coordinator exception mapping:
    DaynestApiClientAuthenticationError → ConfigEntryAuthFailed
    DaynestApiClientCommunicationError → UpdateFailed
    DaynestApiClientTimeoutError → UpdateFailed
    DaynestApiClientServerUnavailableError → UpdateFailed
    DaynestApiClientMalformedResponseError → UpdateFailed
    DaynestApiClientError → UpdateFailed

These mappings reflect the handling in coordinator._async_update_data.
"""

from .client import (
    DaynestApiClient,
    DaynestApiClientAuthenticationError,
    DaynestApiClientCommunicationError,
    DaynestApiClientError,
    DaynestApiClientMalformedResponseError,
    DaynestApiClientServerUnavailableError,
    DaynestApiClientTimeoutError,
    DaynestApiResponse,
    DaynestDashboard,
    DaynestSummary,
)

__all__ = [
    "DaynestApiClient",
    "DaynestApiClientAuthenticationError",
    "DaynestApiClientCommunicationError",
    "DaynestApiClientError",
    "DaynestApiClientMalformedResponseError",
    "DaynestApiClientServerUnavailableError",
    "DaynestApiClientTimeoutError",
    "DaynestApiResponse",
    "DaynestDashboard",
    "DaynestSummary",
]
