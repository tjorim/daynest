"""Config flow for Daynest integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_API_KEY, CONF_URL
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_loaded_integration

from .api import (
    DaynestApiClient,
    DaynestApiClientAuthenticationError,
    DaynestApiClientServerUnavailableError,
    DaynestApiClientTimeoutError,
)
from .const import DOMAIN, LOGGER

SUPPORTED_CONTRACT_VERSIONS = {"1"}

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
            vol.Required(CONF_API_KEY): selector.TextSelector(
                selector.TextSelectorConfig(
                    type=selector.TextSelectorType.PASSWORD,
                ),
            ),
        }
    )


class DaynestConfigFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Daynest."""

    VERSION = 1

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Handle initial config flow step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            normalized_url = str(user_input[CONF_URL]).strip().rstrip("/")
            sanitized_input = {
                CONF_URL: normalized_url,
                CONF_API_KEY: str(user_input[CONF_API_KEY]),
            }

            errors = await self._async_validate_user_input(sanitized_input)
            if not errors:
                await self.async_set_unique_id(normalized_url)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=normalized_url,
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
        """Validate user input by calling Daynest summary endpoint."""
        client = DaynestApiClient(
            session=async_get_clientsession(self.hass),
            base_url=user_input[CONF_URL],
            integration_key=user_input[CONF_API_KEY],
        )

        try:
            summary_response = await client.async_get_summary()
        except DaynestApiClientAuthenticationError as err:
            LOGGER.warning("Failed authentication during Daynest setup: %s", err)
            return {"base": ERROR_AUTH}
        except DaynestApiClientTimeoutError as err:
            LOGGER.warning("Timeout during Daynest setup: %s", err)
            return {"base": ERROR_TIMEOUT}
        except DaynestApiClientServerUnavailableError as err:
            LOGGER.warning("Could not connect to Daynest during setup: %s", err)
            return {"base": ERROR_CANNOT_CONNECT}
        except Exception as err:  # noqa: BLE001
            LOGGER.exception("Unexpected error during Daynest setup: %s", err)
            return {"base": ERROR_UNKNOWN}

        contract_version = summary_response.integration_contract
        if contract_version not in SUPPORTED_CONTRACT_VERSIONS:
            LOGGER.warning(
                "Unsupported Daynest integration contract '%s' received during setup", contract_version
            )
            return {"base": ERROR_UNSUPPORTED_CONTRACT}

        return {}


__all__ = ["DaynestConfigFlowHandler"]
