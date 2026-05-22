"""Set up the Daynest Home Assistant integration."""

from __future__ import annotations

from collections.abc import Mapping
import inspect
from pathlib import Path
from typing import TYPE_CHECKING, Any

from daynest import DaynestClient
from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import (
    CONF_API_KEY,
    CONF_CLIENT_ID,
    CONF_CLIENT_SECRET,
    CONF_URL,
    EVENT_COMPONENT_LOADED,
    Platform,
)
from homeassistant.core import Event
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers import config_entry_oauth2_flow
from homeassistant.helpers.aiohttp_client import async_get_clientsession
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
    build_oidc_authorization_url,
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

PLATFORMS: list[Platform] = [Platform.CALENDAR, Platform.SENSOR, Platform.BINARY_SENSOR, Platform.NUMBER, Platform.TODO]
FRONTEND_DIR = Path(__file__).parent / "frontend"
CARD_URL = "/daynest/static/daynest-card.js"
CARD_RESOURCE_TYPE = "module"
CARD_DEFERRED = "card_deferred"
CARD_REGISTERED = "card_registered"

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Daynest domain."""
    return True


async def _async_register_lovelace_resource(hass: HomeAssistant, resource_url: str) -> bool:
    """Add or update the Daynest card as a Lovelace dashboard resource."""
    lovelace_data = hass.data.get("lovelace")
    if lovelace_data is None:
        LOGGER.debug("Lovelace is not loaded; deferring Daynest card resource registration")
        return False

    resources = lovelace_data.resources if hasattr(lovelace_data, "resources") else lovelace_data["resources"]
    if not isinstance(resources, ResourceStorageCollection):
        LOGGER.debug("Lovelace resources are not storage-backed; loading Daynest card as extra JS: %s", resource_url)
        add_extra_js_url(hass, resource_url)
        return True

    await resources.async_get_info()
    for item in resources.async_items() or []:
        url = str(item.get(CONF_URL, ""))
        if url.partition("?")[0] != CARD_URL:
            continue

        if url != resource_url or item.get("res_type", item.get("type")) != CARD_RESOURCE_TYPE:
            item_id = item.get("id")
            if not isinstance(item_id, str):
                continue
            await resources.async_update_item(
                item_id,
                {"res_type": CARD_RESOURCE_TYPE, CONF_URL: resource_url},
            )
        return True

    await resources.async_create_item(
        {"res_type": CARD_RESOURCE_TYPE, CONF_URL: resource_url},
    )
    return True


async def _async_register_or_defer_lovelace_resource(hass: HomeAssistant, resource_url: str) -> None:
    """Register the Daynest Lovelace resource now, or retry when Lovelace loads."""
    frontend_data = hass.data.setdefault(DOMAIN, {})
    if await _async_register_lovelace_resource(hass, resource_url):
        frontend_data[CARD_REGISTERED] = True
        frontend_data[CARD_DEFERRED] = False
        return

    if frontend_data.get(CARD_DEFERRED):
        return

    frontend_data[CARD_DEFERRED] = True
    unsubscribe: Any = None

    async def _on_lovelace_loaded(event: Event) -> None:
        if event.data.get("component") != "lovelace":
            return
        if unsubscribe is not None:
            unsubscribe()
        try:
            registered = await _async_register_lovelace_resource(hass, resource_url)
        except Exception as err:  # noqa: BLE001
            LOGGER.debug("Deferred Daynest card resource registration failed: %s", err)
            registered = False
        frontend_data[CARD_REGISTERED] = registered
        frontend_data[CARD_DEFERRED] = False

    unsubscribe = hass.bus.async_listen(EVENT_COMPONENT_LOADED, _on_lovelace_loaded)

    if hass.data.get("lovelace"):
        unsubscribe()
        frontend_data[CARD_REGISTERED] = await _async_register_lovelace_resource(hass, resource_url)
        frontend_data[CARD_DEFERRED] = False


def _should_replace_token_url(token_url: str | None, legacy_token_url: str, client_id: str | None) -> bool:
    """Return whether an entry should move to the Daynest-managed token endpoint."""
    return not token_url or (token_url == legacy_token_url and client_id == "home-assistant")


def _resolve_auth_mode(data: Mapping[str, Any]) -> str:
    """Resolve auth mode for an entry, including compatibility fallback."""
    configured = str(data.get(CONF_AUTH_MODE) or "").strip()
    if configured:
        return configured
    return AUTH_MODE_OAUTH_REDIRECT if "token" in data else AUTH_MODE_CLIENT_CREDENTIALS


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
        if _resolve_auth_mode(data) == AUTH_MODE_OAUTH_REDIRECT:
            data.setdefault(CONF_AUTH_MODE, AUTH_MODE_OAUTH_REDIRECT)
            data.setdefault(CONF_AUTHORIZATION_URL, build_oidc_authorization_url(base_url))
            data.setdefault(CONF_TOKEN_URL, build_oidc_token_url(base_url))
        else:
            data.setdefault(CONF_AUTH_MODE, AUTH_MODE_CLIENT_CREDENTIALS)
        hass.config_entries.async_update_entry(entry, data=data, version=4)
        return True

    if entry.version == 4:
        data = dict(entry.data)
        base_url = str(data.get(CONF_URL) or DEFAULT_API_BASE_URL).strip().rstrip("/")
        if _resolve_auth_mode(data) == AUTH_MODE_OAUTH_REDIRECT:
            data.setdefault(CONF_AUTH_MODE, AUTH_MODE_OAUTH_REDIRECT)
            data.setdefault(CONF_AUTHORIZATION_URL, build_oidc_authorization_url(base_url))
            data.setdefault(CONF_TOKEN_URL, build_oidc_token_url(base_url))
        else:
            data.setdefault(CONF_AUTH_MODE, AUTH_MODE_CLIENT_CREDENTIALS)
            legacy_token_url = f"{base_url}/realms/daynest/protocol/openid-connect/token"
            if _should_replace_token_url(data.get(CONF_TOKEN_URL), legacy_token_url, data.get(CONF_CLIENT_ID)):
                data[CONF_TOKEN_URL] = build_token_url(base_url)
        hass.config_entries.async_update_entry(entry, data=data, version=5)
        return True

    return entry.version == 5


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
) -> bool:
    """Set up Daynest from a config entry."""
    base_url = str(entry.data[CONF_URL]).strip().rstrip("/")
    auth_mode = _resolve_auth_mode(entry.data)

    if auth_mode == AUTH_MODE_OAUTH_REDIRECT:
        authorization_url = str(entry.data.get(CONF_AUTHORIZATION_URL) or "").strip().rstrip("/") or build_oidc_authorization_url(base_url)
        token_url = str(entry.data.get(CONF_TOKEN_URL) or "").strip().rstrip("/") or build_oidc_token_url(base_url)

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
            cache_ttl=30,
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

        client = DaynestClient(
            base_url=base_url,
            client_id=entry.data[CONF_CLIENT_ID],
            client_secret=entry.data[CONF_CLIENT_SECRET],
            token_url=token_url,
            session=async_get_clientsession(hass),
            cache_ttl=30,
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
    if not frontend_data.get(CARD_REGISTERED):
        frontend_data[CARD_REGISTERED] = True
        card_path = FRONTEND_DIR / "daynest-card.js"
        if not card_path.exists():
            LOGGER.warning("daynest-card.js not found; dashboard card will not be available")
            frontend_data[CARD_REGISTERED] = False
        else:
            version = entry.runtime_data.integration.version or "0"
            versioned_url = f"{CARD_URL}?v={version}"
            await async_register_static_paths(
                hass,
                [StaticPathConfig(CARD_URL, str(card_path), cache_headers=True)],
            )
            await _async_register_or_defer_lovelace_resource(hass, versioned_url)
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
        if frontend_data.get(CARD_REGISTERED):
            remove_extra_js_url(hass, frontend_data.get("versioned_url", CARD_URL))
            frontend_data[CARD_REGISTERED] = False
        async_unload_services(hass)
    return unload_ok


async def async_reload_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
) -> None:
    """Reload a config entry."""
    await hass.config_entries.async_reload(entry.entry_id)
