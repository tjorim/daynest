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
from homeassistant.const import CONF_CLIENT_ID, CONF_CLIENT_SECRET, CONF_URL
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_loaded_integration

from .const import (
    CONF_TOKEN_URL,
    DOMAIN,
    LOGGER,
    SUPPORTED_INTEGRATION_CONTRACT_VERSIONS,
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
            vol.Required(
                CONF_TOKEN_URL,
                default=defaults.get(CONF_TOKEN_URL, vol.UNDEFINED),
            ): selector.TextSelector(
                selector.TextSelectorConfig(
                    type=selector.TextSelectorType.URL,
                ),
            ),
            vol.Required(
                CONF_CLIENT_ID,
                default=defaults.get(CONF_CLIENT_ID, vol.UNDEFINED),
            ): selector.TextSelector(),
            vol.Required(CONF_CLIENT_SECRET): selector.TextSelector(
                selector.TextSelectorConfig(
                    type=selector.TextSelectorType.PASSWORD,
                ),
            ),
        }
    )


class DaynestConfigFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Daynest."""

    VERSION = 2

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Handle initial config flow step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            sanitized_input = {
                CONF_URL: str(user_input[CONF_URL]).strip().rstrip("/"),
                CONF_TOKEN_URL: str(user_input[CONF_TOKEN_URL]).strip().rstrip("/"),
                CONF_CLIENT_ID: str(user_input[CONF_CLIENT_ID]).strip(),
                CONF_CLIENT_SECRET: str(user_input[CONF_CLIENT_SECRET]),
            }

            errors = await self._async_validate_user_input(sanitized_input)
            if not errors:
                await self.async_set_unique_id(sanitized_input[CONF_URL])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=sanitized_input[CONF_URL],
                    data=sanitized_input,
                )

        integration = async_get_loaded_integration(self.hass, DOMAIN)

        return self.async_show_form(
            step_id="user",
            data_schema=_user_schema(user_input),
            errors=errors,
            description_placeholders={
                "documentation_url": integration.documentation or "",
            },
        )

    async def _async_validate_user_input(self, user_input: dict[str, str]) -> dict[str, str]:
        """Validate credentials by calling the Daynest summary endpoint."""
        client = DaynestClient(
            base_url=user_input[CONF_URL],
            client_id=user_input[CONF_CLIENT_ID],
            client_secret=user_input[CONF_CLIENT_SECRET],
            token_url=user_input[CONF_TOKEN_URL],
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
