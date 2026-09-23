# Daynest MCP Server

Daynest exposes a real MCP server using the official Python SDK (via
`fastmcp`). There are **two independent ways to run it** — a local-user
stdio entry point and an authenticated HTTP mount served by the main FastAPI
app. They are separate code paths, not two modes of the same process: there
is no environment variable that switches one into the other.

## 1. Local-user stdio (`python -m app.mcp_server`)

From `backend/`:

**PowerShell:**
```powershell
uv run python -m app.mcp_server
```

**bash/zsh:**
```bash
uv run python -m app.mcp_server
```

This always runs over `stdio` — the standard transport for local MCP clients
(e.g. Claude Desktop, Claude Code) that spawn the server as a subprocess.
There is no way to switch this entry point to HTTP; use the authenticated
HTTP mount below instead if you need a network-reachable server.

### User selection (stdio only)

The stdio entry point has no bearer token to resolve a user from, so it
falls back to local selection:

If your local database has exactly one active user, the server uses it
automatically.

If you have multiple active users and `DAYNEST_USER_EMAIL` is not set, the
server will refuse to start and raise an error:

```text
ValueError: Multiple active Daynest users found (N matches). Set DAYNEST_USER_EMAIL to the correct account or inspect active users locally.
```

Set `DAYNEST_USER_EMAIL` to the email address of the active user you want
the server to run as:

**PowerShell:**
```powershell
$env:DAYNEST_USER_EMAIL = "you@example.com"
uv run python -m app.mcp_server
```

**bash/zsh:**
```bash
export DAYNEST_USER_EMAIL="you@example.com"
uv run python -m app.mcp_server
```

The provided email must match an **active** user account. Inactive users are
not considered, and a mismatch will produce:

```text
ValueError: Active user not found for DAYNEST_USER_EMAIL=you@example.com
```

Use the `list_users` MCP tool to inspect which accounts are active.

## 2. Authenticated HTTP (mounted by the main FastAPI app)

Running the normal Daynest backend (`uvicorn app.main:app`, or the deployed
container) mounts the MCP server over Streamable HTTP at `/mcp` whenever
`settings.feature_mcp` is enabled (the default) — this is **not** something
you opt into by running `app.mcp_server` differently; it happens
automatically as part of `app.main`, alongside the REST API, in the same
process.

Set `MCP_BASE_URL` to the externally reachable URL of
this mount (used for OAuth resource-server metadata) before starting the
app:

**PowerShell:**
```powershell
$env:MCP_BASE_URL = "https://your-domain.example/mcp"
uv run uvicorn app.main:app
```

**bash/zsh:**
```bash
export MCP_BASE_URL="https://your-domain.example/mcp"
uv run uvicorn app.main:app
```

Two authentication methods are accepted on this mount, matching how
`resolve_principal` (`app/mcp/principal.py`) identifies the caller:

- **Keycloak OIDC** — a Bearer token issued by the realm configured via
  `settings.oidc_issuer_url`/`settings.oidc_audience`. Human users and
  Keycloak service accounts (mapped to a local user via a
  `daynest_user_id` protocol mapper) both work.
- **Integration client keys** — Daynest's existing hashed, revocable,
  rate-limited integration credentials:

  ```http
  Authorization: Bearer daynest_...
  ```

Create an integration client in the Daynest app (or via the
`create_integration_client` MCP tool) to obtain a key.

### Rotating the integration-key hash secret

Managed keys are HMAC-hashed with `INTEGRATION_KEY_HASH_SECRET`. To rotate
that secret without invalidating every issued key at once:

1. Move the old value to `INTEGRATION_KEY_HASH_SECRET_PREVIOUS` and install
   the new value as `INTEGRATION_KEY_HASH_SECRET` in one deployment.
2. Keep both values configured while active clients authenticate. A key
   matched with the previous secret is transparently rehashed with the current
   secret on successful authentication.
3. Remove `INTEGRATION_KEY_HASH_SECRET_PREVIOUS` after the chosen migration
   window. Keys that were not used during that window must then be rotated.

Only one previous secret is accepted, deliberately bounding the fallback
window. Never swap the values or retain a chain of historical secrets.

Check whether this mount is active, and what it currently exposes, via:

```http
GET {api_prefix}/mcp/capabilities
```

This endpoint derives its response live from the running FastMCP server's
actual tool/resource/prompt registration — it cannot drift from what's really
mounted.

The manifest follows capability contract v1, shared by the Travel, Worktime,
Champagnefestival and Daynest MCP servers (tjorim/apps#229):

- Top level: `contract_version` (`1`, also present when MCP is disabled),
  `enabled`, `mount_path`, `version`, `tools`, `resources`, `prompts`.
- Per tool: `name`; `effect` (`read` or `write`); `requires_confirmation`
  (boolean, always `false` for Daynest — it has no confirmation step); and
  `access`, the app-specific policy object. Daynest's `access` holds `auth`
  (`interactive` or `user_or_integration`) and `tier` (`owner` or
  `household_member`). The flat `required_auth` / `required_tier` keys mirror
  it and are deprecated; they will be removed after one release.

The same capability policy sets each tool's standard MCP `ToolAnnotations`
(these are advisory hints for clients, not enforcement):

- `read_only_hint` is true exactly for `read` tools, which are also
  `idempotent_hint: true` and `destructive_hint: false`.
- Writes are `destructive_hint: false` only for `create_`, `add_` and
  `generate_` tools; every other write, and any unknown tool, is treated as
  destructive.
- Writes are `idempotent_hint: true` only for resource-state or delete-to-absent
  operations listed in `docs/retry-safety.md` (`update_`, `delete_`, `revoke_`,
  `set_`, `complete_`, `skip_`, `start_`, `take_`, `reschedule_`, `check_off_`).
  Creates, generation, rotation and relative changes such as `defer_` are not.
- `open_world_hint` is always false.

## Exposed capabilities

Both entry points register the same tools, resources, and prompt — the only
difference is transport and authentication. The server exposes Daynest tools
for:

- current user, local user list, and integration-client management
- today and calendar reads
- planned item CRUD
- chore completion, skip, and reschedule
- routine start, complete, and skip; routine and chore template CRUD
- medication plan CRUD (list, create, update, delete)
- medication dose take, skip, and bulk skip-missed
- shopping list and meal-planning CRUD
- scheduling suggestions (`get_scheduling_suggestions`)
- bounded, user-scoped audit-trail reads (`list_audit_entries`) — every
  mutation above is recorded in the same database transaction as the
  mutation itself; see `app/services/audit_service.py`

It also exposes JSON resources for:

- `daynest://today/{for_date}`
- `daynest://calendar/day/{for_date}`

and a `daily_briefing` prompt.
