# Connect Daynest from a Home Assistant Custom Integration

This guide describes the backend contract expected by the Daynest Home Assistant custom integration that now lives in the monorepo root under `custom_components/daynest`.

## Authentication Requirements

- Home Assistant now uses a browser-based OAuth redirect flow and opens the Daynest sign-in page automatically during setup.
- The integration starts from only the Daynest base URL and derives the OIDC endpoints:
  - `/realms/daynest/protocol/openid-connect/auth`
  - `/realms/daynest/protocol/openid-connect/token`
- The OAuth client ID used by the integration is `home-assistant` (PKCE flow).
- Any valid authenticated token (OIDC or integration key) grants full access to the user's own data.
- Legacy integration-client keys remain supported through `X-Integration-Key` and the integration client token endpoint.

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
  - `planned_remaining_count`
  - `medication_due_count`
  - `completion_ratio`
  - `next_medication`
  - `routines_open_count`
  - `due_today` (list of due chore items; includes today's chores and overdue pending chores; used by `todo.daynest_tasks_due_today`)
  - `planned` (list of planned items; includes today's planned items **and** overdue undone planned items; used by `todo.daynest_tasks_due_today`)

### `GET /api/v1/integrations/home-assistant/entities`

Used by the Home Assistant entity registry bootstrap and diagnostics.

Expected behavior:

- returns `200 OK`
- returns `X-Integration-Contract: home-assistant; version=ha.v1`
- returns a JSON array where each entity object contains:
  - `entity_id`
  - `state`
  - `attributes`

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

- Requires authenticated Daynest connection
- Request body: `{"chore_instance_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/snooze-task`

Used by the `daynest.snooze_task` Home Assistant service.

- Requires authenticated Daynest connection
- Request body: `{"chore_instance_id": <int>, "days": <int, 1–30, default 1>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/mark-medication-taken`

Used by the `daynest.mark_medication_taken` Home Assistant service.

- Requires authenticated Daynest connection
- Request body: `{"medication_dose_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/skip-task`

Used by the `daynest.skip_task` Home Assistant service.

- Requires authenticated Daynest connection
- Request body: `{"chore_instance_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/skip-medication`

Used by the `daynest.skip_medication` Home Assistant service.

- Requires authenticated Daynest connection
- Request body: `{"medication_dose_id": <int>}`
- Returns `{"success": true, "detail": "..."}`

### `POST /api/v1/integrations/home-assistant/actions/create-planned-item`

Used by the Home Assistant to-do create-item flow.

- Requires authenticated Daynest connection
- Request body: `{"title": <str>, "planned_for": <YYYY-MM-DD>, "notes": <str|null>, ...}`
- Returns `{"success": true, "detail": "Planned item <id> created"}`

### `PUT /api/v1/integrations/home-assistant/actions/update-planned-item/{planned_item_id}`

Used by the Home Assistant to-do update-item flow for planned items.

- Requires authenticated Daynest connection
- Request body: `{"title": <str>, "planned_for": <YYYY-MM-DD>, "is_done": <bool>, ...}`
- Returns `{"success": true, "detail": "Planned item <id> updated"}`

### `DELETE /api/v1/integrations/home-assistant/actions/delete-planned-item/{planned_item_id}`

Used by the Home Assistant to-do delete-item flow for planned items.

- Requires authenticated Daynest connection
- Returns `{"success": true, "detail": "Planned item <id> deleted"}`

## Common Errors

### Invalid OAuth Client Credentials

Typical symptoms:

- setup fails with `401` or `403`
- entities remain unavailable

Checks for the automatic OAuth redirect setup:

1. Sign out of Daynest in the browser and retry the integration setup to get a fresh token.

Checks for the legacy/manual client credentials setup:

1. Verify the client ID and secret are copied exactly.
2. Rotate the client secret in Daynest and update Home Assistant if needed.

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

- base URL is reachable from Home Assistant
- token URL is reachable from Home Assistant
- `/summary` returns `200 OK`, the contract header, and required summary fields
- `/dashboard` returns `200 OK`, the contract header, and the expected dashboard payload
- the integration loads without entity availability errors
