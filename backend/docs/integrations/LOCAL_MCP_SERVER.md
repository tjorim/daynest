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

```
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

```
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

Set `DAYNEST_MCP_RESOURCE_SERVER_URL` to the externally reachable URL of
this mount (used for OAuth resource-server metadata) before starting the
app:

**PowerShell:**
```powershell
$env:DAYNEST_MCP_RESOURCE_SERVER_URL = "https://your-domain.example/mcp"
uv run uvicorn app.main:app
```

**bash/zsh:**
```bash
export DAYNEST_MCP_RESOURCE_SERVER_URL="https://your-domain.example/mcp"
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

Check whether this mount is active, and what it currently exposes, via:

```http
GET {api_prefix}/mcp/capabilities
```

This endpoint derives its response live from the running FastMCP server's
actual tool/resource/prompt registration — it cannot drift from what's really
mounted.

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
