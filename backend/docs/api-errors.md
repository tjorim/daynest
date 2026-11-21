# API error contract

Every JSON error the API sends has the same top-level keys. `detail` is an English diagnostic for developers and
logs; the interface shows its own translation, chosen by `code` (see `frontend/src/lib/api/errorMessages.ts`).
Clients must never branch on the wording of `detail`.

| Key | Type | Notes |
|---|---|---|
| `detail` | string (list for a 422) | Diagnostic text. Never a stack trace, an exception message or a secret. |
| `code` | string | Stable, machine-readable. Always present. |
| `params` | object | Optional, only safe, displayable values (for example `{"version": 9}`). |

The shared handlers live in `app/core/errors.py` and are registered in `app/main.py`.

## Where the body comes from

| Failure | Status | `code` | Handler |
|---|---|---|---|
| `ApiException` raised by a route or service | its own | its own (`household_not_found`, ...) | `handle_api_exception` |
| Framework or dependency `HTTPException` (unknown route, wrong method, a bare `HTTPException`) | its own | `bad_request` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404), `method_not_allowed` (405), else `http_<status>` | `handle_http_exception` |
| Request validation | 422 | `validation_error` | `handle_validation_error` |
| Unhandled exception | 500 | `internal_error` | `observability_middleware`, `handle_unhandled_exception` |

- `handle_http_exception` keeps `detail` as it was and adds `code` only when the exception has none. A `code` or
  `params` an `ApiException` carries is never replaced. Headers (`WWW-Authenticate`, `Retry-After`, `Allow`) are passed
  on.
- A 422 keeps FastAPI's `detail` list of `{type, loc, msg}` entries. `input` and `ctx` are dropped from every entry:
  they echo what the caller sent and can carry secrets or personal data.
- An unhandled exception answers `{"detail": "Internal server error", "code": "internal_error"}`. The stack trace
  is logged server side (and sent to Sentry when configured); the body never names the cause. The response carries
  `X-Request-ID`, which is also in the log line, so a report can be traced. `observability_middleware` answers
  exceptions raised below it; the handler registered for `Exception` covers one raised outside it (Starlette's
  `ServerErrorMiddleware`, which bypasses user middleware) and attaches the id itself.

## Not covered

The rate limiter's 429 (`handle_rate_limit_exceeded`) still answers `{"error": "Rate limit exceeded: ..."}`; see
[Rate limiting](RATE_LIMITING.md). OpenAPI documents only FastAPI's default 422 schema, not the generic error body.

`tests/test_error_contract.py` runs the assembled app and pins this contract; `tests/test_api_errors.py` covers the
handlers in isolation.
