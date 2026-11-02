# REST rate limiting

The FastAPI global `rate_limit` dependency enforces `RATE_LIMIT_DEFAULT`
(default `200/minute`) after routing, including routes registered through
`include_router`. It uses the public `limits` API with process-local memory and
fixed windows, as the previous slowapi configuration did. Multiple workers have
independent counters; restarting a worker resets its counters.

Buckets are keyed by client IP and the full route template, including its router
prefix. Different path parameter values and HTTP methods share a template's
bucket. Different templates and client IPs have independent buckets. The existing
trusted-peer handling of Caddy's `X-Real-IP` header is unchanged.

Only `/api/health/liveness` and `/api/health/readiness` are exempt (with `/api`
replaced by the configured `API_PREFIX`). Other REST operations, including
`/api/health`, metadata and REST MCP capability routes, are limited. Rejected
requests return status 429 with `{"error": "Rate limit exceeded: ..."}`,
`Retry-After` and `X-RateLimit-*` headers, and pass through normal request logging
and request ID middleware. `RATE_LIMIT_ENABLED=false` disables enforcement.

The mounted `/mcp` ASGI app does **not** execute FastAPI's REST dependencies and
is explicitly outside this per-IP limit. It retains its own authentication and
per-integration-client limits; public OAuth discovery is not REST-rate-limited.
OpenAPI/docs endpoints, unmatched paths and CORS preflight likewise do not execute
REST operation dependencies.

## Rollout

Included routes previously bypassed the default limit. Before deploying this
change, review access logs grouped by real client IP and route template, especially
shared NAT addresses, polling clients and integrations. Check the busiest minute
against the configured default. This checkout cannot establish production traffic
rates. If a staged rollout is needed, deploy with `RATE_LIMIT_ENABLED=false` while
collecting traffic, choose an appropriate `RATE_LIMIT_DEFAULT`, then enable it.
Disabling enforcement does not produce shadow-limit logs; use access logs for
that analysis. Monitor 429 rates and client reports when enabling enforcement.
