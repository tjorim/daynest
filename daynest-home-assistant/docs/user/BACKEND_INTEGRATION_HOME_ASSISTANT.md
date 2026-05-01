# Connect Daynest from a Home Assistant Custom Integration

This guide explains the backend contract expected when connecting Daynest from a Home Assistant custom integration.

## Authentication Requirements

- Use an API key that includes the required scope: `ha:read`
- For write services, the API key must also include `ha:write`
- Send the API key using the `X-Integration-Key` header:

  ```http
  X-Integration-Key: <DAYNEST_API_KEY>
  ```

If the API key is missing the `ha:read` scope, Home Assistant will not be able to fetch Daynest data.
If the API key is missing the `ha:write` scope, write services will return `403 Forbidden`.

## Base URL Requirements

Use the fully-qualified HTTPS origin for the Daynest backend:

- ✅ `https://api.daynest.example`
- ❌ `http://api.daynest.example` (HTTP not recommended)
- ❌ `api.daynest.example` (scheme missing)
- ❌ `https://api.daynest.example/v1` (the integration appends `/api/v1/...` paths)

Guidelines:

- Include scheme (`https://`)
- Use a reachable host from the Home Assistant runtime environment
- Avoid including API version path segments in the configured base URL
- Avoid trailing slash in stored configuration to prevent double-slash request paths

## Expected Endpoints

The Home Assistant custom integration expects these endpoints to be available under the configured base URL.

### `GET /api/v1/integrations/home-assistant/summary`

Purpose: Lightweight setup-time validation of the configured base URL and integration key.

Expected behavior:

- Returns `200 OK`
- Returns `X-Integration-Contract: home-assistant; version=ha.v1`
- Returns a JSON object with these required fields:
  - `todo_daynest_today`
  - `sensor_daynest_overdue_count`
  - `sensor_daynest_next_medication`

### `GET /api/v1/integrations/home-assistant/dashboard`

Purpose: Returns dashboard data consumed by Home Assistant sensor entities.

Expected behavior:

- Returns `200 OK`
- Returns `X-Integration-Contract: home-assistant; version=ha.v1`
- Returns a JSON object. The integration currently consumes:
  - `for_date`
  - `due_today_count`
  - `overdue_count`
  - `planned_count`
  - `medication_due_count`
  - `completion_ratio`
  - `next_medication`

## Home Assistant Services

The following services are available in the `daynest` domain. Read-only sensor usage requires only `ha:read`. Write services require `ha:write` on the integration API key.

### `daynest.refresh`

Triggers an immediate data refresh from the Daynest backend. No backend write endpoint is involved. Useful after making changes in the Daynest app to update sensors without waiting for the next scheduled poll.

**Required scope:** `ha:read` (no write scope needed)

**Fields:** none

### `daynest.complete_task`

Marks a Daynest chore instance as complete.

**Required scope:** `ha:write`

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_id` | integer | Yes | The numeric ID of the chore instance to mark as complete |

**Backend endpoint:** `POST /api/v1/integrations/home-assistant/actions/complete-task`

### `daynest.snooze_task`

Reschedules a Daynest chore instance to a later date.

**Required scope:** `ha:write`

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_id` | integer | Yes | The numeric ID of the chore instance to reschedule |
| `days` | integer | No (default: 1) | Number of days to snooze (1–30) |

**Backend endpoint:** `POST /api/v1/integrations/home-assistant/actions/snooze-task`

### `daynest.mark_medication_taken`

Marks a scheduled medication dose instance as taken.

**Required scope:** `ha:write`

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `medication_dose_id` | integer | Yes | The numeric ID of the medication dose instance |

**Backend endpoint:** `POST /api/v1/integrations/home-assistant/actions/mark-medication-taken`

## Common Errors and Fixes

### Invalid API Key

Symptoms:

- Setup fails with unauthorized/forbidden errors (`401` or `403`)
- Entities remain unavailable after setup
- Write services fail with `403`

Fixes:

1. Verify the key is copied exactly (no extra spaces/newlines)
2. Verify the key has the `ha:read` scope (and `ha:write` for write services)
3. Regenerate the key and update the integration configuration if needed

### Network Errors

Symptoms:

- Timeout, DNS, or connection refused errors
- Setup validation or dashboard refresh fails intermittently

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
3. Validate endpoint versioning (`/api/v1/integrations/home-assistant/...`) matches the configured backend

## Validation Checklist

- [ ] API key includes `ha:read`
- [ ] Base URL is HTTPS and reachable from Home Assistant
- [ ] `GET /api/v1/integrations/home-assistant/summary` returns `200 OK`, `X-Integration-Contract: home-assistant; version=ha.v1`, and the required summary fields
- [ ] `GET /api/v1/integrations/home-assistant/dashboard` returns `200 OK`, `X-Integration-Contract: home-assistant; version=ha.v1`, and a JSON object
- [ ] Integration loads without entity availability errors
- [ ] (optional) API key includes `ha:write` to enable write services
