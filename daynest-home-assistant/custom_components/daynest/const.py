"""Constants for daynest."""

from logging import Logger, getLogger

LOGGER: Logger = getLogger(__package__)

# Integration metadata
DOMAIN = "daynest"
ATTRIBUTION = "Data provided by http://jsonplaceholder.typicode.com/"
DEFAULT_API_BASE_URL = "https://jsonplaceholder.typicode.com"

# Platform parallel updates - applied to all platforms
PARALLEL_UPDATES = 1

# Default configuration values
DEFAULT_UPDATE_INTERVAL_HOURS = 1
DEFAULT_ENABLE_DEBUGGING = False
