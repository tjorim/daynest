"""Domain modules for the Daynest MCP server.

``app.mcp_server`` is a thin server/auth assembler: it wires up FastMCP,
authentication, and ``@mcp.tool()``/``@mcp.resource()``/``@mcp.prompt()``
registration, but domain behavior lives here, one module per area:

- ``identity``: whoami, users, integration clients.
- ``planning``: today/calendar views and planned items.
- ``routines``: chore templates/instances and routine templates/tasks.
- ``medications``: medication plans and dose instances.
- ``shopping``: shopping lists and meal planning.
- ``audit``: bounded, user-scoped audit-trail reads.

Shared infrastructure (principal resolution, session scoping, error
translation) lives in ``principal``, ``context``, and ``errors``.
"""
