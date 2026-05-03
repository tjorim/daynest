"""Unit tests for custom_components.daynest.config_flow."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from daynest.api.client import (
    DaynestApiClientAuthenticationError,
    DaynestApiClientMalformedResponseError,
    DaynestApiClientServerUnavailableError,
    DaynestApiClientTimeoutError,
    DaynestSummary,
)
from daynest.config_flow import (
    ERROR_AUTH,
    ERROR_CANNOT_CONNECT,
    ERROR_TIMEOUT,
    ERROR_UNKNOWN,
    ERROR_UNSUPPORTED_CONTRACT,
    DaynestConfigFlowHandler,
)

CONTRACT_HEADER_VALID = "home-assistant; version=ha.v1"
CONTRACT_HEADER_UNSUPPORTED = "home-assistant; version=ha.v99"

VALID_SUMMARY_PAYLOAD = {
    "todo_daynest_today": 2,
    "sensor_daynest_overdue_count": 1,
    "sensor_daynest_next_medication": "09:00",
}

USER_INPUT = {
    "url": "https://api.daynest.example",
    "api_key": "valid_key",
}


def _make_summary_response(contract: str | None = CONTRACT_HEADER_VALID) -> MagicMock:
    response = MagicMock()
    response.integration_contract = contract
    response.data = DaynestSummary.from_dict(VALID_SUMMARY_PAYLOAD)
    return response


def _make_handler() -> DaynestConfigFlowHandler:
    handler = DaynestConfigFlowHandler.__new__(DaynestConfigFlowHandler)
    handler.hass = MagicMock()
    return handler


@pytest.mark.unit
class TestConfigFlowValidation:
    """Tests for DaynestConfigFlowHandler._async_validate_user_input."""

    async def test_valid_credentials_return_no_errors(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(return_value=_make_summary_response())
            errors = await handler._async_validate_user_input(USER_INPUT)
        assert errors == {}

    async def test_authentication_error_returns_invalid_auth(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(
                side_effect=DaynestApiClientAuthenticationError()
            )
            errors = await handler._async_validate_user_input(USER_INPUT)
        assert errors == {"base": ERROR_AUTH}

    async def test_timeout_error_returns_timeout(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(
                side_effect=DaynestApiClientTimeoutError()
            )
            errors = await handler._async_validate_user_input(USER_INPUT)
        assert errors == {"base": ERROR_TIMEOUT}

    async def test_server_unavailable_returns_cannot_connect(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(
                side_effect=DaynestApiClientServerUnavailableError()
            )
            errors = await handler._async_validate_user_input(USER_INPUT)
        assert errors == {"base": ERROR_CANNOT_CONNECT}

    async def test_malformed_response_returns_unsupported_contract(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(
                side_effect=DaynestApiClientMalformedResponseError("bad payload")
            )
            errors = await handler._async_validate_user_input(USER_INPUT)
        assert errors == {"base": ERROR_UNSUPPORTED_CONTRACT}

    async def test_unexpected_exception_returns_unknown(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(
                side_effect=RuntimeError("something went very wrong")
            )
            errors = await handler._async_validate_user_input(USER_INPUT)
        assert errors == {"base": ERROR_UNKNOWN}

    async def test_unsupported_contract_version_returns_error(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(
                return_value=_make_summary_response(CONTRACT_HEADER_UNSUPPORTED)
            )
            errors = await handler._async_validate_user_input(USER_INPUT)
        assert errors == {"base": ERROR_UNSUPPORTED_CONTRACT}

    async def test_missing_contract_header_returns_unsupported_contract(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(
                return_value=_make_summary_response(None)
            )
            errors = await handler._async_validate_user_input(USER_INPUT)
        assert errors == {"base": ERROR_UNSUPPORTED_CONTRACT}

    async def test_empty_contract_header_returns_unsupported_contract(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(
                return_value=_make_summary_response("")
            )
            errors = await handler._async_validate_user_input(USER_INPUT)
        assert errors == {"base": ERROR_UNSUPPORTED_CONTRACT}

    async def test_api_client_receives_correct_base_url(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(return_value=_make_summary_response())
            await handler._async_validate_user_input(USER_INPUT)
        _, kwargs = MockClient.call_args
        assert kwargs["base_url"] == USER_INPUT["url"]

    async def test_api_client_receives_correct_integration_key(self) -> None:
        handler = _make_handler()
        with (
            patch("daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("daynest.config_flow.DaynestApiClient") as MockClient,
        ):
            MockClient.return_value.async_get_summary = AsyncMock(return_value=_make_summary_response())
            await handler._async_validate_user_input(USER_INPUT)
        _, kwargs = MockClient.call_args
        assert kwargs["integration_key"] == USER_INPUT["api_key"]
