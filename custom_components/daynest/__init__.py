"""Set up the Daynest Home Assistant integration."""

from __future__ import annotations

import inspect
from pathlib import Path
from typing import TYPE_CHECKING, Any

from daynest import DaynestClient
from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import CONF_API_KEY, CONF_CLIENT_ID, CONF_CLIENT_SECRET, CONF_URL, Platform
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers import config_entry_oauth2_flow
import homeassistant.helpers.config_validation as cv
from homeassistant.loader import async_get_loaded_integration

from .const import (
    AUTH_MODE_CLIENT_CREDENTIALS,
    AUTH_MODE_OAUTH_REDIRECT,
    CONF_AUTH_MODE,
    CONF_AUTHORIZATION_URL,
    CONF_TOKEN_URL,
    DEFAULT_API_BASE_URL,
    DEFAULT_OIDC_CLIENT_ID,
    DOMAIN,
    LOGGER,
    build_authorization_url,
    build_oidc_token_url,
    build_token_url,
)
from .coordinator import DaynestDataUpdateCoordinator
from .data import DaynestData
from .services import async_setup_services, async_unload_services

try:
    from homeassistant.components.frontend import async_register_static_paths
except ImportError:
    async def async_register_static_paths(
        hass: Any,
        static_paths: list[StaticPathConfig],
    ) -> None:
        """Register static paths on older Home Assistant versions."""
        maybe_awaitable = hass.http.async_register_static_paths(static_paths)
        if inspect.isawaitable(maybe_awaitable):
            await maybe_awaitable

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import DaynestConfigEntry

PLATFORMS: list[Platform] = [Platform.CALENDAR, Platform.SENSOR, Platform.TODO]
FRONTEND_DIR = Path(__file__).parent / "frontend"
CARD_URL = "/daynest/frontend/daynest-card.js"

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Daynest domain."""
    return True


def _should_replace_token_url(token_url: str | None, legacy_token_url: str, client_id: str | None) -> bool:
    """Return whether an entry should move to the Daynest-managed token endpoint."""
    return not token_url or (token_url == legacy_token_url and client_id == "home-assistant")


async def async_migrate_entry(hass: HomeAssistant, entry: DaynestConfigEntry) -> bool:
    """Migrate old config entries to the current OAuth credentials shape."""
    if entry.version == 1:
        data = dict(entry.data)
        base_url = str(data.get(CONF_URL) or DEFAULT_API_BASE_URL).strip().rstrip("/")
        legacy_secret = data.get(CONF_API_KEY) or data.get("api_key") or data.get("integration_key")

        data[CONF_URL] = base_url
        data.setdefault(CONF_CLIENT_ID, "home-assistant")
        if legacy_secret is not None:
            data.setdefault(CONF_CLIENT_SECRET, str(legacy_secret))
        data[CONF_TOKEN_URL] = build_token_url(base_url)
        data[CONF_AUTH_MODE] = AUTH_MODE_CLIENT_CREDENTIALS

        hass.config_entries.async_update_entry(entry, data=data, version=4)
        LOGGER.warning("Migrated legacy Daynest entry to the Daynest-managed OAuth token endpoint")
        return True

    if entry.version == 2:
        data = dict(entry.data)
        base_url = str(data.get(CONF_URL) or DEFAULT_API_BASE_URL).strip().rstrip("/")
        legacy_token_url = f"{base_url}/realms/daynest/protocol/openid-connect/token"
        if _should_replace_token_url(data.get(CONF_TOKEN_URL), legacy_token_url, data.get(CONF_CLIENT_ID)):
            data[CONF_TOKEN_URL] = build_token_url(base_url)
        data[CONF_AUTH_MODE] = AUTH_MODE_CLIENT_CREDENTIALS
        hass.config_entries.async_update_entry(entry, data=data, version=4)
        return True

    if entry.version == 3:
        data = dict(entry.data)
        base_url = str(data.get(CONF_URL) or DEFAULT_API_BASE_URL).strip().rstrip("/")
        if "token" in data:
            data.setdefault(CONF_AUTH_MODE, AUTH_MODE_OAUTH_REDIRECT)
            data.setdefault(CONF_AUTHORIZATION_URL, build_authorization_url(base_url))
            data.setdefault(CONF_TOKEN_URL, build_oidc_token_url(base_url))
        else:
            data.setdefault(CONF_AUTH_MODE, AUTH_MODE_CLIENT_CREDENTIALS)
        hass.config_entries.async_update_entry(entry, data=data, version=4)
        return True

    return entry.version == 4


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
) -> bool:
    """Set up Daynest from a config entry."""
    base_url = str(entry.data[CONF_URL]).strip().rstrip("/")
    auth_mode = str(entry.data.get(CONF_AUTH_MODE) or "").strip() or (
        AUTH_MODE_OAUTH_REDIRECT if "token" in entry.data else AUTH_MODE_CLIENT_CREDENTIALS
    )

    if auth_mode == AUTH_MODE_OAUTH_REDIRECT:
        authorization_url = str(entry.data.get(CONF_AUTHORIZATION_URL) or "").strip().rstrip("/")
        token_url = str(entry.data.get(CONF_TOKEN_URL) or "").strip().rstrip("/")
        if not authorization_url:
            authorization_url = build_authorization_url(base_url)
        if not token_url:
            token_url = build_oidc_token_url(base_url)
        if (
            entry.data.get(CONF_AUTHORIZATION_URL) != authorization_url
            or entry.data.get(CONF_TOKEN_URL) != token_url
            or entry.data.get(CONF_AUTH_MODE) != AUTH_MODE_OAUTH_REDIRECT
        ):
            hass.config_entries.async_update_entry(
                entry,
                data={
                    **entry.data,
                    CONF_AUTH_MODE: AUTH_MODE_OAUTH_REDIRECT,
                    CONF_AUTHORIZATION_URL: authorization_url,
                    CONF_TOKEN_URL: token_url,
                },
            )

        oauth_impl = config_entry_oauth2_flow.LocalOAuth2ImplementationWithPkce(
            hass,
            DOMAIN,
            DEFAULT_OIDC_CLIENT_ID,
            authorization_url,
            token_url,
        )
        oauth_session = config_entry_oauth2_flow.OAuth2Session(hass, entry, oauth_impl)

        async def _access_token_getter() -> str | None:
            await oauth_session.async_ensure_token_valid()
            token = oauth_session.token.get("access_token")
            return token if isinstance(token, str) else None

        client = DaynestClient(
            base_url=base_url,
            access_token_getter=_access_token_getter,
            session=async_get_clientsession(hass),
        )
    else:
        missing_keys = [
            key
            for key in (CONF_CLIENT_ID, CONF_CLIENT_SECRET)
            if not entry.data.get(key)
        ]
        if missing_keys:
            msg = "Daynest entry is missing OAuth credentials; reconfigure the integration"
            raise ConfigEntryAuthFailed(msg)

        token_url = str(entry.data.get(CONF_TOKEN_URL) or "").strip().rstrip("/")
        legacy_token_url = f"{base_url}/realms/daynest/protocol/openid-connect/token"
        if _should_replace_token_url(token_url, legacy_token_url, entry.data.get(CONF_CLIENT_ID)):
            token_url = build_token_url(base_url)
            if entry.data.get(CONF_TOKEN_URL) != token_url or entry.data.get(CONF_AUTH_MODE) != AUTH_MODE_CLIENT_CREDENTIALS:
                hass.config_entries.async_update_entry(
                    entry,
                    data={**entry.data, CONF_TOKEN_URL: token_url, CONF_AUTH_MODE: AUTH_MODE_CLIENT_CREDENTIALS},
                )

        client = DaynestClient(
            base_url=base_url,
            client_id=entry.data[CONF_CLIENT_ID],
            client_secret=entry.data[CONF_CLIENT_SECRET],
            token_url=token_url,
            session=async_get_clientsession(hass),
        )

    coordinator = DaynestDataUpdateCoordinator(
        hass=hass,
        config_entry=entry,
        client=client,
    )

    entry.runtime_data = DaynestData(
        client=client,
        integration=async_get_loaded_integration(hass, entry.domain),
        coordinator=coordinator,
    )

    await coordinator.async_config_entry_first_refresh()
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(async_reload_entry))

    if not hass.services.has_service(DOMAIN, "refresh"):
        await async_setup_services(hass)

    frontend_data = hass.data.setdefault(DOMAIN, {})
    if not frontend_data.get("card_registered"):
        frontend_data["card_registered"] = True
        card_path = FRONTEND_DIR / "daynest-card.js"
        if not card_path.exists():
            LOGGER.warning("daynest-card.js not found; dashboard card will not be available")
            frontend_data["card_registered"] = False
        else:
            version = entry.runtime_data.integration.version or "0"
            versioned_url = f"{CARD_URL}?v={version}"
            await async_register_static_paths(
                hass,
                [StaticPathConfig(CARD_URL, str(card_path), cache_headers=True)],
            )
            add_extra_js_url(hass, versioned_url)
            frontend_data["versioned_url"] = versioned_url

    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    remaining = [
        e for e in hass.config_entries.async_entries(DOMAIN) if e.entry_id != entry.entry_id
    ]
    remaining_loaded = [
        e for e in remaining if e.state is ConfigEntryState.LOADED
    ]
    if unload_ok and not remaining_loaded:
        frontend_data = hass.data.setdefault(DOMAIN, {})
        if frontend_data.get("card_registered"):
            remove_extra_js_url(hass, frontend_data.get("versioned_url", CARD_URL))
            frontend_data["card_registered"] = False
        async_unload_services(hass)
    return unload_ok


async def async_reload_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
) -> None:
    """Reload a config entry."""
    await hass.config_entries.async_reload(entry.entry_id)
