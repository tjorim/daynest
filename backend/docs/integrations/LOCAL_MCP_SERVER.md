# Local MCP Server

Daynest now exposes a real MCP server using the official Python SDK.

## Run

From `backend/`:

```powershell
uv run python -m app.mcp_server
```

The default transport is `stdio`, which is the standard local MCP mode.

## Remote Streamable HTTP

For hosted use, run the MCP server with Streamable HTTP:

```powershell
$env:DAYNEST_MCP_TRANSPORT = "streamable-http"
$env:DAYNEST_MCP_RESOURCE_SERVER_URL = "https://your-domain.example/mcp"
$env:DAYNEST_MCP_ISSUER_URL = "https://your-domain.example/mcp"
$env:DAYNEST_MCP_ALLOWED_HOSTS = "your-domain.example"
$env:DAYNEST_MCP_ALLOWED_ORIGINS = "https://your-domain.example"
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

If you have multiple active users, set:

```powershell
$env:DAYNEST_USER_EMAIL = "you@example.com"
uv run python -m app.mcp_server
```

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
