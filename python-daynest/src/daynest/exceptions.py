"""Daynest client exceptions."""


class DaynestError(Exception):
    """Base exception for all Daynest client errors."""


class DaynestCommunicationError(DaynestError):
    """Generic transport-level failure."""


class DaynestAuthError(DaynestError):
    """Authentication or authorization failure reported by the backend."""


class DaynestTimeoutError(DaynestCommunicationError):
    """Request timed out before receiving a response."""


class DaynestServerUnavailableError(DaynestCommunicationError):
    """Backend is unavailable or returned an upstream/server error."""


class DaynestMalformedResponseError(DaynestError):
    """Response payload could not be parsed into the expected model."""


class DaynestNotFoundError(DaynestError):
    """Requested resource does not exist (404)."""
