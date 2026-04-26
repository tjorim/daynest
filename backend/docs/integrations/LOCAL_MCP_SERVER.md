# Local MCP Server

Daynest now exposes a real MCP server using the official Python SDK.

## Run

From `backend/`:

**PowerShell:**
```powershell
uv run python -m app.mcp_server
```

**bash/zsh:**
```bash
uv run python -m app.mcp_server
```

The default transport is `stdio`, which is the standard local MCP mode.

## Remote Streamable HTTP

For hosted use, run the MCP server with Streamable HTTP:

**PowerShell:**
```powershell
$env:DAYNEST_MCP_TRANSPORT = "streamable-http"
$env:DAYNEST_MCP_RESOURCE_SERVER_URL = "https://your-domain.example/mcp"
$env:DAYNEST_MCP_ISSUER_URL = "https://your-domain.example/mcp"
$env:DAYNEST_MCP_ALLOWED_HOSTS = "your-domain.example"
$env:DAYNEST_MCP_ALLOWED_ORIGINS = "https://your-domain.example"
uv run python -m app.mcp_server
```

**bash/zsh:**
```bash
export DAYNEST_MCP_TRANSPORT="streamable-http"
export DAYNEST_MCP_RESOURCE_SERVER_URL="https://your-domain.example/mcp"
export DAYNEST_MCP_ISSUER_URL="https://your-domain.example/mcp"
export DAYNEST_MCP_ALLOWED_HOSTS="your-domain.example"
export DAYNEST_MCP_ALLOWED_ORIGINS="https://your-domain.example"
uv run python -m app.mcp_server
```

The MCP endpoint path is `/mcp`.

Authentication for remote use is Bearer-token based and reuses Daynest integration client keys.

Create an integration client with the `mcp:read` scope, then send:

```http
Authorization: Bearer daynest_...
```

This follows the MCP SDK authentication hooks while reusing the existing Daynest integration key model.

## User Selection

If your local database has exactly one active user, the server uses it automatically.

If you have multiple active users and `DAYNEST_USER_EMAIL` is not set, the server will refuse to start and raise an error:

```
ValueError: Multiple active Daynest users found (N matches). Set DAYNEST_USER_EMAIL to the correct account or inspect active users locally.
```

Set `DAYNEST_USER_EMAIL` to the email address of the active user you want the server to run as:

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

The provided email must match an **active** user account. Inactive users are not considered, and a mismatch will produce:

```
ValueError: Active user not found for DAYNEST_USER_EMAIL=you@example.com
```

Use the `list_users` MCP tool to inspect which accounts are active.

## Exposed Capabilities

The server exposes Daynest tools for:

- current user inspection
- today and calendar reads
- planned item CRUD
- chore completion, skip, and reschedule
- routine start, complete, and skip
- medication take and skip

It also exposes JSON resources for:

- `daynest://today/{for_date}`
- `daynest://calendar/day/{for_date}`
