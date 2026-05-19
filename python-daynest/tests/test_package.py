"""Smoke tests verifying the package structure is importable."""

from collections.abc import AsyncContextManager

from daynest import (
    DaynestAuthError,
    DaynestClient,
    DaynestCommunicationError,
    DaynestError,
    DaynestMalformedResponseError,
    DaynestNotFoundError,
    DaynestServerUnavailableError,
    DaynestTimeoutError,
)


def test_public_api_importable() -> None:
    assert DaynestClient is not None
    assert DaynestError is not None
    assert DaynestAuthError is not None
    assert DaynestCommunicationError is not None
    assert DaynestTimeoutError is not None
    assert DaynestServerUnavailableError is not None
    assert DaynestMalformedResponseError is not None
    assert DaynestNotFoundError is not None


def test_exception_hierarchy() -> None:
    assert issubclass(DaynestAuthError, DaynestError)
    assert issubclass(DaynestCommunicationError, DaynestError)
    assert issubclass(DaynestTimeoutError, DaynestCommunicationError)
    assert issubclass(DaynestServerUnavailableError, DaynestCommunicationError)
    assert issubclass(DaynestMalformedResponseError, DaynestError)
    assert issubclass(DaynestNotFoundError, DaynestError)


def test_client_context_manager_protocol() -> None:
    client = DaynestClient(base_url="https://api.example", integration_key="key")
    assert isinstance(client, AsyncContextManager)
