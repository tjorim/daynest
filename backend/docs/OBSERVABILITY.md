# Observability Contract

This document describes the observability guarantees that apply to every HTTP request handled by the Daynest backend. **Any new route must be added through the standard FastAPI router so it automatically inherits this contract.**

---

## X-Request-ID

| Behaviour | Detail |
|---|---|
| **Generation** | If the incoming request carries no `X-Request-ID` header, the middleware generates a UUID4 and assigns it. |
| **Propagation** | If the incoming request supplies `X-Request-ID`, that value is used unchanged. |
| **Echo** | Every response carries `X-Request-ID` in its headers regardless of status code. |
| **Scope** | The ID is stored in `request.state.request_id` and is available to all downstream handlers and dependencies. |

Clients that want end-to-end tracing across their own systems should supply `X-Request-ID` on every outbound request.

---

## Structured Request Log

Every request emits one JSON log line via the `app.observability` logger after the response is sent. The log level reflects the outcome:

- `INFO` — 1xx / 2xx / 3xx
- `WARNING` — 4xx
- `ERROR` — 5xx (also captures the exception in Sentry when configured)

### Log payload fields

| Field | Type | Notes |
|---|---|---|
| `event` | `"http_request"` | Constant — use this to filter in log aggregators. |
| `request_id` | `string` | UUID4 (generated or propagated). |
| `user_id` | `int \| null` | Local user ID. `null` for unauthenticated and system routes. |
| `auth_type` | `"oidc" \| "integration_key" \| "integration_jwt" \| null` | How the caller authenticated. `null` for unauthenticated requests. |
| `method` | `string` | HTTP verb (`GET`, `POST`, …). |
| `route` | `string` | URL path only — **query parameters are never logged** to prevent token leakage (relevant for the SSE stream route that accepts a bearer token via `?token=`). |
| `status_code` | `int` | HTTP response status. |
| `latency_ms` | `float` | Wall-clock time in milliseconds from first byte received to response headers sent. For SSE connections this is time-to-first-byte, not stream duration. |

Example:

```json
{"event":"http_request","request_id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","user_id":42,"auth_type":"oidc","method":"POST","route":"/api/v1/today/planned-items","status_code":201,"latency_ms":18.4}
```

---

## Health Endpoints

| Endpoint | Auth | Behaviour |
|---|---|---|
| `GET /api/v1/health/liveness` | None | Returns `{"status": "alive"}` immediately. Use this to tell the process is up. |
| `GET /api/v1/health/readiness` | None | Runs `SELECT 1` against the database with a 2-second timeout. Returns `{"status": "ready"}` (200) or `{"status": "not_ready"}` (503). |
| `GET /api/v1/health` | None | Returns liveness status inline and the URL of the readiness endpoint. |

**Deployment note:** Configure your load balancer or orchestrator to use `/api/v1/health/readiness` for traffic routing (not liveness). A failing readiness check means the database is unreachable; the process itself is still alive.

---

## Metrics Endpoint

| Endpoint | Auth |
|---|---|
| `GET /api/v1/metrics` | `X-Metrics-Token` header: `<unix-timestamp>:<hex HMAC-SHA256 of timestamp>`, signed with `METRICS_HMAC_SECRET` |

Returns a JSON snapshot of in-process counters:

| Field | Description |
|---|---|
| `uptime_seconds` | Seconds since the process started. |
| `request_total` | Total requests handled in this process lifetime. |
| `error_total` | Total 5xx responses. |
| `request_rate_per_second` | `request_total / uptime_seconds`. |
| `error_rate` | `error_total / request_total` (0 if no requests). |
| `latency_avg_ms` | Average request latency. |
| `latency_max_ms` | Maximum request latency observed. |

**Important limitations:**
- Metrics are **process-local** and reset on every restart.
- In a multi-worker deployment (multiple Uvicorn/Gunicorn workers) each process has independent counters — values are **not** aggregated across workers.
- For production-grade aggregated metrics, export to Prometheus or another time-series system.

The endpoint returns 404 if `METRICS_HMAC_SECRET` is not set in the environment (so it's invisible to scanners), or 403 if the token is missing, malformed, incorrectly signed, or more than 60 seconds old (rejecting stale/replayed tokens).

---

## Error Tracking (Sentry)

Sentry is initialised at startup if `SENTRY_DSN` is set. Configuration:

| Setting | Default | Notes |
|---|---|---|
| `SENTRY_DSN` | _(unset)_ | Sentry not active when unset. |
| `ENVIRONMENT` | `"development"` | Sent as the Sentry environment tag. |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.0` | Set to > 0 to enable performance tracing. |
| `send_default_pii` | `False` | Hard-coded off — IP addresses, cookies, and request bodies are never sent to Sentry. |

All unhandled exceptions (those not converted to HTTP responses by FastAPI's exception handlers) are captured via `sentry_sdk.capture_exception()` and also emit an `ERROR` log.

---

## Coverage Across Route Types

| Route type | Observability middleware | `user_id` logged | `auth_type` logged |
|---|---|---|---|
| Standard OIDC-authenticated routes | ✓ | ✓ | `"oidc"` |
| Integration-key routes | ✓ | ✓ | `"integration_key"` |
| Integration-JWT routes | ✓ | ✓ | `"integration_jwt"` |
| SSE live-update stream (`/api/v1/today/stream`) | ✓ | ✓ | `"oidc"` |
| MCP routes (`/mcp/*`) | ✓ (path + latency) | ✗ (MCP handles auth internally) | ✗ |
| Unauthenticated system routes (health, metrics) | ✓ | `null` | `null` |

**MCP note:** The `/mcp` sub-app is mounted on the FastAPI app, so the observability middleware records path, latency, and status for every MCP request. However, user resolution for MCP is handled inside `fastmcp`'s framework (via `get_access_token()`), not via `request.state`, so `user_id` and `auth_type` are `null` in MCP log lines.

---

## Adding a New Route — Checklist

Before merging a new backend route:

- [ ] Route is added via `app.include_router(...)` or inside an existing router — not via `app.mount()` with a sub-application that bypasses middleware.
- [ ] If the route accepts a bearer token in a query parameter, verify that `request.url.path` (not `request.url`) is what gets logged.
- [ ] If the route introduces a new auth mechanism, ensure it sets `request.state.user_id` and `request.state.auth_type` so log lines are complete.
- [ ] System/internal routes that should not be user-accessible use `_require_metrics_access` or equivalent protection.
