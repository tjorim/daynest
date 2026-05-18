"""Daynest client exceptions."""


class DaynestError(Exception):
    """Base exception for all Daynest client errors."""


class DaynestAuthError(DaynestError):
    """Raised when authentication fails (401/403)."""


class DaynestNotFoundError(DaynestError):
    """Raised when a requested resource does not exist (404)."""
