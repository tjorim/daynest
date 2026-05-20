"""Config flow for Daynest integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from daynest import (
    DaynestAuthError,
    DaynestClient,
    DaynestCommunicationError,
    DaynestMalformedResponseError,
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
    VERSION = 4

    @property
    def logger(self) -> Any:
        """Return integration logger for OAuth helper."""
        return LOGGER

    @property
    def extra_authorize_data(self) -> dict[str, str]:
        """Request Daynest scopes needed by the integration."""
        return {"scope": "openid profile email offline_access ha:read ha:write"}

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Handle initial config flow step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            base_url = str(user_input[CONF_URL]).strip().rstrip("/")
            authorization_url = build_oidc_authorization_url(base_url)
            oidc_token_url = build_oidc_token_url(base_url)

            self.flow_impl = config_entry_oauth2_flow.LocalOAuth2ImplementationWithPkce(
                self.hass,
                DOMAIN,
                DEFAULT_OIDC_CLIENT_ID,
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

    async def async_oauth_create_entry(self, data: dict[str, Any]) -> config_entries.ConfigFlowResult:
        """Create config entry after OAuth redirect is complete."""
        base_url = str(self.context[CONF_URL])
        errors = await self._async_validate_oauth_token(base_url, data["token"])
        if errors:
            return self.async_abort(reason=errors["base"])

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
