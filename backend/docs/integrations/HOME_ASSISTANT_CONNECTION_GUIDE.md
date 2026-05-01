# Connect Daynest from a Home Assistant Custom Integration

This guide describes the backend contract expected by the Daynest Home Assistant custom integration that now lives in the monorepo root under `custom_components/daynest`.

## Authentication Requirements

- Use an API key with the required scope: `ha:read`
- For write operations (services), the API key must also include `ha:write`
- Send the API key using the `X-Integration-Key` header

```http
X-Integration-Key: <DAYNEST_API_KEY>
```

If the API key is missing the `ha:read` scope, Home Assistant will not be able to fetch Daynest data.
If the API key is missing the `ha:write` scope, write services (`complete_task`, `snooze_task`, `mark_medication_taken`) will be rejected with `403 Forbidden`.

## Base URL Requirements

Use the fully-qualified Daynest backend origin:

- `https://api.daynest.example`

Avoid:

- bare hosts without scheme
- versioned API paths in the configured base URL
- trailing slashes in stored configuration

The integration appends `/api/v1/...` itself.

## Expected Endpoints

### `GET /api/v1/integrations/home-assistant/summary`

Used for lightweight setup-time validation.

Expected behavior:

- returns `200 OK`
- returns `X-Integration-Contract: home-assistant; version=ha.v1`
- returns a JSON object with:
  - `todo_daynest_today`
  - `sensor_daynest_overdue_count`
  - `sensor_daynest_next_medication`

### `GET /api/v1/integrations/home-assistant/dashboard`

Used by the Home Assistant sensor entities.

Expected behavior:

- returns `200 OK`
- returns `X-Integration-Contract: home-assistant; version=ha.v1`
- returns a JSON object containing:
  - `for_date`
  - `due_today_count`
  - `overdue_count`
  - `planned_count`
  - `medication_due_count`
  - `completion_ratio`
  - `next_medication`

### `POST /api/v1/integrations/home-assistant/actions/complete-task`

Used by the `daynest.complete_task` Home Assistant service.

- Requires `ha:write` scope
- Request body: `{"task_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/snooze-task`

Used by the `daynest.snooze_task` Home Assistant service.

- Requires `ha:write` scope
- Request body: `{"task_id": <int>, "days": <int, 1–30, default 1>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/mark-medication-taken`

Used by the `daynest.mark_medication_taken` Home Assistant service.

- Requires `ha:write` scope
- Request body: `{"medication_dose_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

## Auth Scopes

| Scope | Required for |
|-------|-------------|
| `ha:read` | All GET endpoints (summary, dashboard, entities); required for setup |
| `ha:write` | All POST action endpoints (complete-task, snooze-task, mark-medication-taken) |

Use least-privilege: create a read-only key (`ha:read`) for sensor-only setups and add `ha:write` only when you need automation write support.

## Common Errors

### Invalid API Key

Typical symptoms:

- setup fails with `401` or `403`
- entities remain unavailable

Checks:

1. Verify the key is copied exactly.
2. Verify the key includes `ha:read` (and `ha:write` for write services).
3. Regenerate the key and update the integration if needed.

### Network Errors

Typical symptoms:

- timeout, DNS, or connection refused errors
- setup validation or refresh fails intermittently

Checks:

1. Confirm Home Assistant can resolve and reach the backend host.
2. Verify firewall, reverse proxy, and TLS settings.
3. Confirm the configured base URL uses the correct scheme and host.

### Contract Mismatch

Typical symptoms:

- parsing errors in logs
- sensors remain unavailable despite successful auth

Checks:

1. Ensure the expected endpoints exist and return JSON.
2. Ensure response keys and types match the integration contract.
3. Ensure the contract header is present and matches `ha.v1`.

## Validation Checklist

- API key includes `ha:read`
- base URL is reachable from Home Assistant
- `/summary` returns `200 OK`, the contract header, and required summary fields
- `/dashboard` returns `200 OK`, the contract header, and the expected dashboard payload
- the integration loads without entity availability errors
- (optional) API key includes `ha:write` for service automation support

