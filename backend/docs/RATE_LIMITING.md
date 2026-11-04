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

## Request-limit contract

Rate limiting uses public FastAPI dependencies and the public `limits` API.
Full route templates include static router prefixes: methods and different IDs
share a bucket, while different prefixes and clients remain independent.
`Retry-After` and `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`X-RateLimit-Reset` survive explicit responses, authentication/validation errors
and streams. Multiple configured windows are supported; a rejection reports the
longest exhausted window. A 429 is not cacheable and is raised before the route
handler; it does not make an uncertain earlier write safe to retry. Reconcile
writes after a timeout rather than automatically replaying them.

Client keys validate `X-Real-IP` only behind the private immediate Caddy peer;
malformed values fall back to the peer. IPv6 subscribers share a /64 bucket and
IPv4-mapped addresses share the IPv4 bucket. Keep the API port private and Caddy's
header replacement enabled; private-peer trust relies on that network boundary.

Counters are fixed-window and process-local; the current Docker command starts
one worker. Restarting resets counters. Add shared storage before deploying
multiple workers or replicas; do not multiply the effective allowance silently.

Review access logs by client and route before rollout, particularly shared NATs
and polling clients. Keep existing thresholds and exemptions. Where enforcement
or bucket grouping changes, `RATE_LIMIT_ENABLED=false` can stage rollout while
traffic is measured; it is not a shadow-counting mode. Monitor 429 rates when
enabling enforcement. Mounted MCP applications retain their own policies.

Purpose-specific 429 responses retain their own backoff and quota headers. A
general allowance never overwrites a stricter endpoint policy or reports a
positive general balance as the cause of that rejection.

Body admission runs after route selection but before the first body read, so
malformed JSON consumes the same allowance and an exhausted request is rejected
before decoding. The dependency covers bodyless requests; a per-request marker
prevents double charging. Mounted applications remain outside the REST policy.
