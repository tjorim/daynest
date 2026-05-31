"""Constants for the Daynest integration."""

from logging import Logger, getLogger

LOGGER: Logger = getLogger(__package__)

DOMAIN = "daynest"
CONF_TOKEN_URL = "token_url"
CONF_AUTHORIZATION_URL = "authorization_url"
CONF_AUTH_MODE = "auth_mode"
ATTRIBUTION = "Data provided by Daynest"
DEFAULT_API_BASE_URL = "http://localhost:8000"
DEFAULT_OIDC_CLIENT_ID = "home-assistant"
AUTH_MODE_OAUTH_REDIRECT = "oauth_redirect"
AUTH_MODE_CLIENT_CREDENTIALS = "client_credentials"
SUPPORTED_INTEGRATION_CONTRACT_VERSIONS = frozenset({"ha.v1", "ha.v2"})
LEGACY_CONTRACT_VERSION_ALIASES = {"1": "ha.v1"}

PARALLEL_UPDATES = 1

DEFAULT_UPDATE_INTERVAL_HOURS = 1
DEFAULT_ENABLE_DEBUGGING = False


def build_token_url(base_url: str) -> str:
    """Build the Daynest OAuth token URL for Home Assistant."""
    return f"{base_url.rstrip('/')}/api/integrations/clients/token"


def build_oidc_authorization_url(base_url: str) -> str:
    """Build the Daynest OIDC authorization URL for Home Assistant."""
    return f"{base_url.rstrip('/')}/realms/daynest/protocol/openid-connect/auth"


def build_oidc_token_url(base_url: str) -> str:
    """Build the Daynest OIDC token URL for Home Assistant redirect auth."""
    return f"{base_url.rstrip('/')}/realms/daynest/protocol/openid-connect/token"


def parse_integration_contract_version(contract: str | None) -> str | None:
    """Extract and normalize the version token from a contract header value."""
    if contract is None:
        return None

    normalized_contract = contract.strip()
    if not normalized_contract:
        return None

    version_token = normalized_contract
    for segment in normalized_contract.split(";"):
        key, separator, value = segment.strip().partition("=")
        if separator and key.strip() == "version":
            version_token = value.strip()
            if not version_token:
                return None
            break

    return LEGACY_CONTRACT_VERSION_ALIASES.get(version_token, version_token)
