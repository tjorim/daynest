# Connect Daynest from a Home Assistant Custom Integration

This guide explains the backend contract expected when connecting Daynest from a Home Assistant custom integration.

## Authentication Requirements

- Use an API key that includes the required scope: `ha:read`
- Send the API key using the `Authorization` header:

  ```http
  Authorization: Bearer <DAYNEST_API_KEY>
  ```

If the API key is missing the `ha:read` scope, Home Assistant will not be able to fetch Daynest data.

## Base URL Requirements

Use a fully-qualified HTTPS base URL for the Daynest backend:

- ✅ `https://api.daynest.example`
- ✅ `https://api.daynest.example/v1`
- ❌ `http://api.daynest.example` (HTTP not recommended)
- ❌ `api.daynest.example` (scheme missing)

Guidelines:

- Include scheme (`https://`)
- Use a reachable host from the Home Assistant runtime environment
- Avoid trailing slash in stored configuration to prevent double-slash request paths

## Expected Endpoints

The Home Assistant custom integration expects these read endpoints to be available under the configured base URL.

### `GET /health`

Purpose: Lightweight connectivity check used during setup and diagnostics.

Expected behavior:

- Returns `200 OK` when the backend is available
- Response body may include status metadata

### `GET /v1/air-quality`

Purpose: Returns dashboard air quality data consumed by sensor entities.

Expected behavior:

- Returns `200 OK`
- Returns JSON payload with current air quality values (for example AQI and PM2.5)

### `GET /v1/device`

Purpose: Returns device metadata used for device registry information and diagnostics.

Expected behavior:

- Returns `200 OK`
- Returns stable identifiers and model information

## Common Errors and Fixes

### Invalid API Key

Symptoms:

- Setup fails with unauthorized/forbidden errors (`401` or `403`)
- Entities remain unavailable after setup

Fixes:

1. Verify the key is copied exactly (no extra spaces/newlines)
2. Verify the key has the `ha:read` scope
3. Regenerate the key and update the integration configuration if needed

### Network Errors

Symptoms:

- Timeout, DNS, or connection refused errors
- Health check fails intermittently

Fixes:

1. Confirm Home Assistant can resolve and reach the backend hostname
2. Verify firewall, reverse proxy, and TLS certificate configuration
3. Confirm base URL uses the correct scheme/port/path

### Contract Mismatch

Symptoms:

- Parsing errors in logs
- Sensors appear as unavailable despite successful authentication
- Diagnostics show missing expected fields

Fixes:

1. Ensure expected endpoints exist and return JSON
2. Ensure response keys and data types match the integration contract
3. Validate endpoint versioning (`/v1/...`) matches the configured backend

## Validation Checklist

- [ ] API key includes `ha:read`
- [ ] Base URL is HTTPS and reachable from Home Assistant
- [ ] `GET /health` returns `200 OK`
- [ ] Expected `/v1/...` endpoints return JSON with required fields
- [ ] Integration loads without entity availability errors
