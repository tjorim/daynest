"""Config flow for Daynest integration."""

from __future__ import annotations

import base64
from collections.abc import Mapping
import json
import logging
from typing import Any

import aiohttp
import voluptuous as vol

from daynest import (
    DaynestAuthError,
    DaynestClient,
    DaynestCommunicationError,
    DaynestMalformedResponseError,
    DaynestNotFoundError,
    DaynestServerUnavailableError,
    DaynestTimeoutError,
)
from homeassistant import config_entries
from homeassistant.const import CONF_URL
from homeassistant.helpers import config_entry_oauth2_flow, selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_loaded_integration

from .const import (
    AUTH_MODE_OAUTH_REDIRECT,
    CONF_AUTH_MODE,
    CONF_AUTHORIZATION_URL,
    CONF_TOKEN_URL,
    DEFAULT_OIDC_CLIENT_ID,
    DOMAIN,
    LOGGER,
    SUPPORTED_INTEGRATION_CONTRACT_VERSIONS,
    build_oidc_authorization_url,
    build_oidc_token_url,
    parse_integration_contract_version,
)

ERROR_AUTH = "invalid_auth"
ERROR_CANNOT_CONNECT = "cannot_connect"
ERROR_TIMEOUT = "timeout"
ERROR_UNSUPPORTED_CONTRACT = "unsupported_contract"
ERROR_UNKNOWN = "unknown"


def _decode_id_token_sub(id_token: str) -> str | None:
    """Extract the sub claim from an OIDC ID token without verifying the signature."""
    try:
        parts = id_token.split(".")
        if len(parts) < 2:
            return None
        padding = (4 - len(parts[1]) % 4) % 4
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * padding))
        sub = payload.get("sub")
        return str(sub) if sub else None
    except Exception:  # noqa: BLE001
        return None


def _user_schema(defaults: dict[str, Any] | None = None) -> vol.Schema:
    """Return schema for user setup flow."""
    defaults = defaults or {}
    return vol.Schema(
        {
            vol.Required(
                CONF_URL,
                default=defaults.get(CONF_URL, vol.UNDEFINED),
            ): selector.TextSelector(
                selector.TextSelectorConfig(
                    type=selector.TextSelectorType.URL,
                ),
            ),
        }
    )


class DaynestConfigFlowHandler(config_entry_oauth2_flow.AbstractOAuth2FlowHandler, domain=DOMAIN):
    """Handle a config flow for Daynest."""

    DOMAIN = DOMAIN
    VERSION = 5

    @property
    def logger(self) -> logging.Logger:
        """Return integration logger for OAuth helper."""
        return LOGGER

    @property
    def extra_authorize_data(self) -> dict[str, str]:
        """Request Daynest scopes needed by the integration."""
        return {"scope": "openid profile email offline_access ha:read ha:write"}

    async def _async_fetch_oidc_config(self, base_url: str) -> tuple[str, str, str] | None:
        """Fetch OIDC endpoints from the Daynest backend. Returns (authorization_url, token_url, client_id) or None on failure."""
        url = f"{base_url}/api/v1/auth/oidc-config"
        try:
            session = async_get_clientsession(self.hass)
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["authorization_url"], data["token_url"], DEFAULT_OIDC_CLIENT_ID
        except Exception:  # noqa: BLE001
            pass
        return None

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Handle initial config flow step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            base_url = str(user_input[CONF_URL]).strip().rstrip("/")

            oidc = await self._async_fetch_oidc_config(base_url)
            if oidc is None:
                errors[CONF_URL] = ERROR_CANNOT_CONNECT
            else:
                authorization_url, oidc_token_url, client_id = oidc
                self.flow_impl = config_entry_oauth2_flow.LocalOAuth2ImplementationWithPkce(
                    self.hass,
                    DOMAIN,
                    client_id,
                    authorization_url,
                    oidc_token_url,
                )
                self.context.update(
                    {
                        CONF_URL: base_url,
                        CONF_AUTHORIZATION_URL: authorization_url,
                        CONF_TOKEN_URL: oidc_token_url,
                    }
                )

                # Preliminary guard: abort immediately if this URL is already configured.
                await self.async_set_unique_id(base_url)
                self._abort_if_unique_id_configured()
                return await self.async_step_auth()

        integration = async_get_loaded_integration(self.hass, DOMAIN)
        return self.async_show_form(
            step_id="user",
            data_schema=_user_schema(user_input),
            errors=errors,
            description_placeholders={
                "documentation_url": integration.documentation or "",
            },
        )

    async def async_step_reauth(
        self, entry_data: Mapping[str, Any]
    ) -> config_entries.ConfigFlowResult:
        """Handle reauthentication when the OAuth token is no longer valid."""
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Show confirmation and restart the OAuth redirect flow."""
        if user_input is None:
            return self.async_show_form(step_id="reauth_confirm")

        reauth_entry = self._get_reauth_entry()
        base_url = str(reauth_entry.data[CONF_URL]).strip().rstrip("/")

        oidc = await self._async_fetch_oidc_config(base_url)
        if oidc is not None:
            authorization_url, token_url, client_id = oidc
        else:
            # Fall back to stored values or derived URLs if backend is unreachable.
            authorization_url = (
                str(reauth_entry.data.get(CONF_AUTHORIZATION_URL) or "").strip()
                or build_oidc_authorization_url(base_url)
            )
            token_url = (
                str(reauth_entry.data.get(CONF_TOKEN_URL) or "").strip()
                or build_oidc_token_url(base_url)
            )
            client_id = DEFAULT_OIDC_CLIENT_ID

        self.flow_impl = config_entry_oauth2_flow.LocalOAuth2ImplementationWithPkce(
            self.hass,
            DOMAIN,
            client_id,
            authorization_url,
            token_url,
        )
        self.context.update(
            {
                CONF_URL: base_url,
                CONF_AUTHORIZATION_URL: authorization_url,
                CONF_TOKEN_URL: token_url,
            }
        )
        return await self.async_step_auth()

    async def async_oauth_create_entry(self, data: dict[str, Any]) -> config_entries.ConfigFlowResult:
        """Create or update config entry after OAuth redirect is complete."""
        base_url = str(self.context[CONF_URL])
        errors = await self._async_validate_oauth_token(base_url, data["token"])
        if errors:
            return self.async_abort(reason=errors["base"])

        sub = _decode_id_token_sub(str(data["token"].get("id_token") or ""))
        await self.async_set_unique_id(sub or base_url)

        if self.source == config_entries.SOURCE_REAUTH:
            reauth_entry = self._get_reauth_entry()
            return self.async_update_reload_and_abort(
                reauth_entry,
                data={
                    **reauth_entry.data,
                    **data,
                    CONF_URL: base_url,
                    CONF_AUTH_MODE: AUTH_MODE_OAUTH_REDIRECT,
                    CONF_AUTHORIZATION_URL: str(self.context[CONF_AUTHORIZATION_URL]),
                    CONF_TOKEN_URL: str(self.context[CONF_TOKEN_URL]),
                },
            )

        self._abort_if_unique_id_configured()
        return self.async_create_entry(
            title=base_url,
            data={
                **data,
                CONF_URL: base_url,
                CONF_AUTH_MODE: AUTH_MODE_OAUTH_REDIRECT,
                CONF_AUTHORIZATION_URL: str(self.context[CONF_AUTHORIZATION_URL]),
                CONF_TOKEN_URL: str(self.context[CONF_TOKEN_URL]),
            },
        )

    async def _async_validate_oauth_token(self, base_url: str, token: dict[str, Any]) -> dict[str, str]:
        """Validate OAuth token by calling the Daynest summary endpoint."""
        access_token = token.get("access_token")
        if not isinstance(access_token, str) or not access_token:
            return {"base": ERROR_AUTH}

        client = DaynestClient(
            base_url=base_url,
            access_token_getter=lambda: access_token,
            session=async_get_clientsession(self.hass),
        )

        try:
            summary_response = await client.async_get_summary()
        except DaynestAuthError as err:
            LOGGER.warning("Failed authentication during Daynest setup: %s", err)
            return {"base": ERROR_AUTH}
        except DaynestTimeoutError as err:
            LOGGER.warning("Timeout during Daynest setup: %s", err)
            return {"base": ERROR_TIMEOUT}
        except DaynestNotFoundError as err:
            LOGGER.warning("Daynest summary endpoint not found — wrong base URL?: %s", err)
            return {"base": ERROR_CANNOT_CONNECT}
        except DaynestServerUnavailableError as err:
            LOGGER.warning("Could not connect to Daynest during setup: %s", err)
            return {"base": ERROR_CANNOT_CONNECT}
        except DaynestCommunicationError as err:
            LOGGER.warning("Communication error during Daynest setup: %s", err)
            return {"base": ERROR_CANNOT_CONNECT}
        except DaynestMalformedResponseError as err:
            LOGGER.warning("Malformed or unsupported Daynest setup response: %s", err)
            return {"base": ERROR_UNSUPPORTED_CONTRACT}
        except Exception as err:  # noqa: BLE001
            LOGGER.exception("Unexpected error during Daynest setup: %s", err)
            return {"base": ERROR_UNKNOWN}

        contract_version = parse_integration_contract_version(summary_response.integration_contract)
        if contract_version not in SUPPORTED_INTEGRATION_CONTRACT_VERSIONS:
            LOGGER.warning(
                "Unsupported Daynest integration contract '%s' received during setup",
                summary_response.integration_contract,
            )
            return {"base": ERROR_UNSUPPORTED_CONTRACT}

        return {}


__all__ = ["DaynestConfigFlowHandler"]
