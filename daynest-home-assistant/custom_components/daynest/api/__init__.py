"""
API package for daynest.

Architecture:
    Three-layer data flow: Entities → Coordinator → API Client.
    Only the coordinator should call the API client. Entities must never
    import or call the API client directly.

Exception hierarchy:
    DaynestApiClientError (base)
    ├── DaynestApiClientCommunicationError (network/timeout)
    └── DaynestApiClientAuthenticationError (401/403)

Coordinator exception mapping:
    ApiClientAuthenticationError → ConfigEntryAuthFailed (triggers reauth)
    ApiClientCommunicationError → UpdateFailed (auto-retry)
    ApiClientError             → UpdateFailed (auto-retry)
"""

from .client import (
    DaynestApiClient,
    DaynestApiClientAuthenticationError,
    DaynestApiClientCommunicationError,
    DaynestApiClientError,
)

__all__ = [
    "DaynestApiClient",
    "DaynestApiClientAuthenticationError",
    "DaynestApiClientCommunicationError",
    "DaynestApiClientError",
]
