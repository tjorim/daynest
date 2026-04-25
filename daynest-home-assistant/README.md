# Daynest Home Assistant Integration

Custom Home Assistant integration for Daynest.

## What It Does

The integration connects Home Assistant to the Daynest backend adapter endpoints and exposes read-only dashboard sensors for:

- tasks due today
- overdue count
- planned count
- medication due count
- completion ratio
- next medication

## Configuration

Add the integration from Home Assistant and provide:

- the Daynest base URL
- an integration API key with the `ha:read` scope

The integration validates the backend contract header and currently supports `home-assistant; version=ha.v1`.

## Development Status

This repository was originally generated from a broader Home Assistant blueprint. The integration has been trimmed down to the active Daynest runtime path:

- config flow
- API client
- coordinator
- diagnostics
- sensor platform

Template demo entities and service examples have been removed.
