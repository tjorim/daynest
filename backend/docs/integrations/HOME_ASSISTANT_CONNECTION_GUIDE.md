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
If the API key is missing the `ha:write` scope, write services (`complete_task`, `snooze_task`, `mark_medication_taken`, `skip_task`, `skip_medication`) will be rejected with `403 Forbidden`.

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

Used by the Home Assistant sensor entities and the Daynest to-do list entity.

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
  - `due_today` (optional list of due chore items; used by `todo.daynest_tasks_due_today`)
  - `planned` (optional list of planned items; used by `todo.daynest_tasks_due_today`)

### Home Assistant to-do entity

The integration now registers:

- `todo.daynest_tasks_due_today`

This entity reads task items from `due_today` and `planned` in the dashboard payload and maps status to Home Assistant to-do states:

- pending / not done → needs action
- completed / done / skipped / taken → complete

Write behavior:

- Mark complete (HA) is supported for `due_today` chore items and maps to `complete-task`.
- Delete (HA) is supported for `due_today` chore items and maps to `skip-task`.
- Creating new items in HA creates Daynest `planned` items.
- Updating/deleting `planned` items from HA is supported via planned-item integration actions.

### `POST /api/v1/integrations/home-assistant/actions/complete-task`

Used by the `daynest.complete_task` Home Assistant service.

- Requires `ha:write` scope
- Request body: `{"chore_instance_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/snooze-task`

Used by the `daynest.snooze_task` Home Assistant service.

- Requires `ha:write` scope
- Request body: `{"chore_instance_id": <int>, "days": <int, 1–30, default 1>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/mark-medication-taken`

Used by the `daynest.mark_medication_taken` Home Assistant service.

- Requires `ha:write` scope
- Request body: `{"medication_dose_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/skip-task`

Used by the `daynest.skip_task` Home Assistant service.

- Requires `ha:write` scope
- Request body: `{"chore_instance_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/skip-medication`

Used by the `daynest.skip_medication` Home Assistant service.

- Requires `ha:write` scope
- Request body: `{"medication_dose_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/create-planned-item`

Used by the Home Assistant to-do create-item flow.

- Requires `ha:write` scope
- Request body: `{"title": <str>, "planned_for": <YYYY-MM-DD>, "notes": <str|null>, ...}`
- Returns `{"success": true, "detail": "Planned item <id> created"}`

### `PUT /api/v1/integrations/home-assistant/actions/update-planned-item/{planned_item_id}`

Used by the Home Assistant to-do update-item flow for planned items.

- Requires `ha:write` scope
- Request body: `{"title": <str>, "planned_for": <YYYY-MM-DD>, "is_done": <bool>, ...}`
- Returns `{"success": true, "detail": "Planned item <id> updated"}`

### `DELETE /api/v1/integrations/home-assistant/actions/delete-planned-item/{planned_item_id}`

Used by the Home Assistant to-do delete-item flow for planned items.

- Requires `ha:write` scope
- Returns `{"success": true, "detail": "Planned item <id> deleted"}`

## Auth Scopes

| Scope | Required for |
|-------|-------------|
| `ha:read` | All GET endpoints (summary, dashboard, entities); required for setup |
| `ha:write` | All write action endpoints (complete-task, snooze-task, mark-medication-taken, skip-task, skip-medication, create/update/delete planned-item) |

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
