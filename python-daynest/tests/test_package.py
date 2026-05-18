"""Smoke tests verifying the package structure is importable."""

from daynest import DaynestAuthError, DaynestClient, DaynestError, DaynestNotFoundError


def test_public_api_importable() -> None:
    assert DaynestClient is not None
    assert DaynestError is not None
    assert DaynestAuthError is not None
    assert DaynestNotFoundError is not None


def test_exception_hierarchy() -> None:
    assert issubclass(DaynestAuthError, DaynestError)
    assert issubclass(DaynestNotFoundError, DaynestError)


def test_client_context_manager_protocol() -> None:
    assert hasattr(DaynestClient, "__aenter__")
    assert hasattr(DaynestClient, "__aexit__")
