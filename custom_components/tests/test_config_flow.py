"""Unit tests for custom_components.daynest.config_flow."""

from __future__ import annotations

import base64
import json
from unittest.mock import AsyncMock, MagicMock, patch

from daynest.models import DaynestSummary
import pytest

from custom_components.daynest.config_flow import (
    ERROR_AUTH,
    ERROR_CANNOT_CONNECT,
    ERROR_TIMEOUT,
    ERROR_UNKNOWN,
    ERROR_UNSUPPORTED_CONTRACT,
    DaynestConfigFlowHandler,
    _decode_id_token_sub,
    _user_schema,
)
from custom_components.daynest.const import (
    AUTH_MODE_OAUTH_REDIRECT,
    CONF_AUTH_MODE,
    CONF_AUTHORIZATION_URL,
    CONF_TOKEN_URL,
    build_oidc_authorization_url,
    build_oidc_token_url,
)
from daynest import DaynestAuthError, DaynestMalformedResponseError, DaynestServerUnavailableError, DaynestTimeoutError
from homeassistant import config_entries
from homeassistant.const import CONF_URL

CONTRACT_HEADER_VALID = "home-assistant; version=ha.v1"
CONTRACT_HEADER_UNSUPPORTED = "home-assistant; version=ha.v99"

VALID_SUMMARY_PAYLOAD = {
    "sensor_daynest_chores_due": 2,
    "sensor_daynest_routines_open": 1,
    "sensor_daynest_medication_due": 1,
    "sensor_daynest_planned_remaining": 3,
    "sensor_daynest_overdue_count": 1,
    "sensor_daynest_next_medication": "Vitamin D @ 09:00",
}

BASE_URL = "https://api.daynest.example"
TOKEN = {"access_token": "valid_access_token"}


def _make_summary_response(contract: str | None = CONTRACT_HEADER_VALID) -> MagicMock:
    response = MagicMock()
    response.integration_contract = contract
    response.data = DaynestSummary.from_dict(VALID_SUMMARY_PAYLOAD)
    return response


def _make_jwt(payload: dict) -> str:
    """Build a minimal unsigned JWT string for testing."""
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"header.{encoded}.sig"


def _make_handler(*, source: str = "user") -> DaynestConfigFlowHandler:
    handler = DaynestConfigFlowHandler.__new__(DaynestConfigFlowHandler)
    handler.hass = MagicMock()
    handler.source = source
    handler.context = {
        CONF_URL: BASE_URL,
        CONF_AUTHORIZATION_URL: build_oidc_authorization_url(BASE_URL),
        CONF_TOKEN_URL: build_oidc_token_url(BASE_URL),
    }
    handler.async_abort = MagicMock(side_effect=lambda **kwargs: {"type": "abort", **kwargs})
    handler.async_create_entry = MagicMock(side_effect=lambda **kwargs: {"type": "create_entry", **kwargs})
    handler.async_set_unique_id = AsyncMock()
    handler._abort_if_unique_id_configured = MagicMock()
    return handler


@pytest.mark.unit
class TestConfigFlowValidation:
    """Tests for DaynestConfigFlowHandler token validation."""

    def test_user_schema_only_requests_base_url(self) -> None:
        schema_keys = {key.schema for key in _user_schema().schema}
        assert schema_keys == {CONF_URL}

    async def test_valid_oauth_token_returns_no_errors(self) -> None:
        handler = _make_handler()
        with (
            patch("custom_components.daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("custom_components.daynest.config_flow.DaynestClient") as mock_client,
        ):
            mock_client.return_value.async_get_summary = AsyncMock(return_value=_make_summary_response())
            errors = await handler._async_validate_oauth_token(BASE_URL, TOKEN)
        assert errors == {}

    async def test_missing_access_token_returns_invalid_auth(self) -> None:
        handler = _make_handler()
        errors = await handler._async_validate_oauth_token(BASE_URL, {})
        assert errors == {"base": ERROR_AUTH}

    async def test_authentication_error_returns_invalid_auth(self) -> None:
        handler = _make_handler()
        with (
            patch("custom_components.daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("custom_components.daynest.config_flow.DaynestClient") as mock_client,
        ):
            mock_client.return_value.async_get_summary = AsyncMock(side_effect=DaynestAuthError())
            errors = await handler._async_validate_oauth_token(BASE_URL, TOKEN)
        assert errors == {"base": ERROR_AUTH}

    async def test_timeout_error_returns_timeout(self) -> None:
        handler = _make_handler()
        with (
            patch("custom_components.daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("custom_components.daynest.config_flow.DaynestClient") as mock_client,
        ):
            mock_client.return_value.async_get_summary = AsyncMock(side_effect=DaynestTimeoutError())
            errors = await handler._async_validate_oauth_token(BASE_URL, TOKEN)
        assert errors == {"base": ERROR_TIMEOUT}

    async def test_server_unavailable_returns_cannot_connect(self) -> None:
        handler = _make_handler()
        with (
            patch("custom_components.daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("custom_components.daynest.config_flow.DaynestClient") as mock_client,
        ):
            mock_client.return_value.async_get_summary = AsyncMock(side_effect=DaynestServerUnavailableError())
            errors = await handler._async_validate_oauth_token(BASE_URL, TOKEN)
        assert errors == {"base": ERROR_CANNOT_CONNECT}

    async def test_malformed_response_returns_unsupported_contract(self) -> None:
        handler = _make_handler()
        with (
            patch("custom_components.daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("custom_components.daynest.config_flow.DaynestClient") as mock_client,
        ):
            mock_client.return_value.async_get_summary = AsyncMock(side_effect=DaynestMalformedResponseError("bad payload"))
            errors = await handler._async_validate_oauth_token(BASE_URL, TOKEN)
        assert errors == {"base": ERROR_UNSUPPORTED_CONTRACT}

    async def test_unexpected_exception_returns_unknown(self) -> None:
        handler = _make_handler()
        with (
            patch("custom_components.daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("custom_components.daynest.config_flow.DaynestClient") as mock_client,
        ):
            mock_client.return_value.async_get_summary = AsyncMock(side_effect=RuntimeError("something went wrong"))
            errors = await handler._async_validate_oauth_token(BASE_URL, TOKEN)
        assert errors == {"base": ERROR_UNKNOWN}

    async def test_unsupported_contract_version_returns_error(self) -> None:
        handler = _make_handler()
        with (
            patch("custom_components.daynest.config_flow.async_get_clientsession", return_value=MagicMock()),
            patch("custom_components.daynest.config_flow.DaynestClient") as mock_client,
        ):
            mock_client.return_value.async_get_summary = AsyncMock(
                return_value=_make_summary_response(CONTRACT_HEADER_UNSUPPORTED)
            )
            errors = await handler._async_validate_oauth_token(BASE_URL, TOKEN)
        assert errors == {"base": ERROR_UNSUPPORTED_CONTRACT}

    async def test_oauth_create_entry_persists_redirect_auth_metadata(self) -> None:
        handler = _make_handler()
        with patch.object(handler, "_async_validate_oauth_token", AsyncMock(return_value={})):
            result = await handler.async_oauth_create_entry({"token": TOKEN, "auth_implementation": "daynest"})

        assert result["type"] == "create_entry"
        entry_data = result["data"]
        assert entry_data[CONF_URL] == BASE_URL
        assert entry_data[CONF_AUTH_MODE] == AUTH_MODE_OAUTH_REDIRECT
        assert entry_data[CONF_AUTHORIZATION_URL] == build_oidc_authorization_url(BASE_URL)
        assert entry_data[CONF_TOKEN_URL] == build_oidc_token_url(BASE_URL)

    async def test_oauth_create_entry_uses_id_token_sub_as_unique_id(self) -> None:
        handler = _make_handler()
        token_with_id = {**TOKEN, "id_token": _make_jwt({"sub": "user-abc-123"})}
        with patch.object(handler, "_async_validate_oauth_token", AsyncMock(return_value={})):
            await handler.async_oauth_create_entry({"token": token_with_id, "auth_implementation": "daynest"})
        handler.async_set_unique_id.assert_awaited_once_with("user-abc-123")

    async def test_oauth_create_entry_falls_back_to_base_url_when_no_id_token(self) -> None:
        handler = _make_handler()
        with patch.object(handler, "_async_validate_oauth_token", AsyncMock(return_value={})):
            await handler.async_oauth_create_entry({"token": TOKEN, "auth_implementation": "daynest"})
        handler.async_set_unique_id.assert_awaited_once_with(BASE_URL)

    async def test_oauth_create_entry_on_reauth_updates_entry_not_creates(self) -> None:
        handler = _make_handler(source=config_entries.SOURCE_REAUTH)
        existing_entry = MagicMock()
        existing_entry.data = {
            CONF_URL: BASE_URL,
            CONF_AUTH_MODE: AUTH_MODE_OAUTH_REDIRECT,
            CONF_AUTHORIZATION_URL: build_oidc_authorization_url(BASE_URL),
            CONF_TOKEN_URL: build_oidc_token_url(BASE_URL),
        }
        handler._get_reauth_entry = MagicMock(return_value=existing_entry)
        handler.async_update_reload_and_abort = MagicMock(
            return_value={"type": "abort", "reason": "reauth_successful"}
        )

        with patch.object(handler, "_async_validate_oauth_token", AsyncMock(return_value={})):
            result = await handler.async_oauth_create_entry({"token": TOKEN, "auth_implementation": "daynest"})

        assert result["reason"] == "reauth_successful"
        handler.async_update_reload_and_abort.assert_called_once()
        handler.async_create_entry.assert_not_called()


@pytest.mark.unit
class TestDecodeIdTokenSub:
    """Tests for the _decode_id_token_sub helper."""

    def test_extracts_sub_from_valid_jwt(self) -> None:
        token = _make_jwt({"sub": "user-xyz"})
        assert _decode_id_token_sub(token) == "user-xyz"

    def test_returns_none_for_missing_sub(self) -> None:
        token = _make_jwt({"email": "user@example.com"})
        assert _decode_id_token_sub(token) is None

    def test_returns_none_for_empty_string(self) -> None:
        assert _decode_id_token_sub("") is None

    def test_returns_none_for_malformed_token(self) -> None:
        assert _decode_id_token_sub("not.a.jwt") is None
