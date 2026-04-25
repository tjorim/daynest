"""Constants for the Daynest integration."""

from logging import Logger, getLogger

LOGGER: Logger = getLogger(__package__)

DOMAIN = "daynest"
ATTRIBUTION = "Data provided by Daynest"
DEFAULT_API_BASE_URL = "http://localhost:8000"
SUPPORTED_INTEGRATION_CONTRACT_VERSIONS = frozenset({"ha.v1"})
LEGACY_CONTRACT_VERSION_ALIASES = {"1": "ha.v1"}

PARALLEL_UPDATES = 1

DEFAULT_UPDATE_INTERVAL_HOURS = 1
DEFAULT_ENABLE_DEBUGGING = False


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
        if separator and key == "version":
            version_token = value.strip()
            if not version_token:
                return None
            break

    return LEGACY_CONTRACT_VERSION_ALIASES.get(version_token, version_token)
