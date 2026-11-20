# API fixture contracts

All ordinary successful JSON responses in MSW handlers and tests use
`jsonResponse<GeneratedResponse>(body)` from `@/mocks/response`. Import the contract
from `@/api-schema` or its screen aliases in `@/api-types`; array responses use
`GeneratedResponse[]`. The helper uses `NoInfer` and a `never` default so omitting
the type argument cannot silently accept an arbitrary body. Seed builders and
mocked API functions also retain their generated return types. Test-local API doubles
use `vi.fn<typeof import("@/lib/api/module").function>()`; query-hook test envelopes
use the generated data types and actual mutation signatures.

`pnpm typecheck` includes `src`, `tests` and `e2e`, checks negative compile probes,
and runs `fixtures:check`. The AST guard covers every handler, test-local and
browser fixture: it rejects raw JSON success factories and arbitrary/inferred
helper arguments. Its own mutation probes prove these failures.

Exceptions preserve the values/assertions being tested:

- HTTP error envelopes use raw `HttpResponse.json` with an inline `Fixture exception`
  reason and a 4xx/5xx status. They are not ordinary success records.
- The today SSE handler is an intentionally empty event stream, not JSON.
- Bodyless `Response(null)` / `HttpResponse(null)` fixtures cover control flow,
  offline replay, errors and 204 deletes; no JSON contract applies.
- localStorage and OIDC storage fixtures model local persistence, not API responses.
- Two UI control sentinels retain their old values with inline reasons: TodayPage
  rendering tests never invoke the shared mutation `{}` double; AuthProvider tests
  intentionally return `null` from fetchMe to isolate OIDC/session plumbing. Neither
  is an ordinary successful response fixture.
- The compile-only negative file is deliberately excluded from the runtime source
  guard; TypeScript checks its `@ts-expect-error` failures instead.
- Create/rotate integration mock payloads retain their existing extra `is_active`
  value through a documented spread; the generated contract checks all actual
  response fields. This is a legacy mock extra, not a backend schema change.

No malformed successful JSON fixture is currently exempted. Future malformed
fixtures need a specific documented exception and a guard test; do not use `any`,
casts or a local response type to bypass the API contract.
