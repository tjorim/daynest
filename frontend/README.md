# Daynest Frontend

React 19 · TypeScript · TanStack Router / Query · Vite · Vitest

## Getting started

```bash
pnpm install
pnpm dev          # requires a running backend + Keycloak
pnpm dev:mock     # no backend required — see Mock mode below
pnpm build
pnpm test
```

---

## Mock mode

Mock mode starts the app with MSW v2 intercepting all API calls. No backend, database, or Keycloak session is needed.

```bash
VITE_MSW=true pnpm dev
# or shorthand:
pnpm dev:mock
```

The service worker (`public/mockServiceWorker.js`) is kept up to date automatically by the `postinstall` script. If you upgrade MSW, reinstall dependencies to refresh it.

### Fixture scenarios

Append `?mock-scenario=<name>` to the URL to load a specific fixture state. The scenario is applied once on page load; refreshing the page resets it.

| `?mock-scenario=` | Description | Key items to observe |
|---|---|---|
| `default` (or omitted) | Busy today view | Medications, routines, chores, planned items |
| `empty` | Fresh household | All lists empty, first-run surfaces |
| `busy-today` | Same as default | Multiple items across all sections |
| `overdue` | Overdue chores + missed medications | Overdue section populated, missed-dose badges |
| `medication-refill` | All medications active | Refill-needed edge cases |
| `template-crud` | Templates pre-populated | Routine & chore template lists |
| `signed-out` | Unauthenticated state | Login prompt, 401 responses |
| `expired-session` | Expired token | Mid-session 401 responses |
| `api-error` | Today endpoint returns 500 | Error boundary / retry UI |

### Recommended screenshot routes

| URL | Viewport | What to capture |
|---|---|---|
| `http://localhost:5173/today` | 1280×800 (desktop) | Today overview — all sections |
| `http://localhost:5173/today` | 390×844 (mobile) | Mobile today view |
| `http://localhost:5173/today?mock-scenario=overdue` | 1280×800 | Overdue chores + missed meds |
| `http://localhost:5173/today?mock-scenario=empty` | 1280×800 | Empty / first-run state |
| `http://localhost:5173/today?mock-scenario=api-error` | 1280×800 | Error UI with retry |

---

## Testing

### Test suites

| Suite | Command | Description |
|---|---|---|
| `dom` | `pnpm test` | Component tests (jsdom), mock API via `vi.mock()` |
| `node` | `pnpm test` | Library / API fetch tests (Node environment) |
| `msw` | `pnpm test` | Component + API tests backed by real MSW handlers |

Run a specific suite:

```bash
pnpm vitest run --project msw
pnpm vitest run --project dom
```

### Writing MSW-backed tests

Place test files under `tests/msw/` with a `.test.ts` or `.test.tsx` extension. The `setup.msw.ts` file wires the server lifecycle automatically:

- `server.listen()` before all tests
- `setOidcAccessToken(MOCK_TOKEN)` before each test (satisfies the auth check in `fetchWithAuth`)
- `server.resetHandlers()` + `resetMockState()` after each test

Per-test handler overrides use `server.use()` — they are scoped to that test and cleaned up automatically:

```typescript
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";

it("shows error UI on 500", async () => {
  server.use(
    http.get("/api/v1/today", () =>
      HttpResponse.json({ detail: "Server error" }, { status: 500 }),
    ),
  );
  // render and assert error UI...
});
```

### Shared handlers

All handlers live in `src/mocks/handlers/`. They read from and write to the in-memory state in `src/mocks/data/state.ts`. Call `resetMockState()` in `afterEach` (already done in `setup.msw.ts`) to restore the default seed data between tests.

---

## Project structure

```
src/
├── app/            App bootstrap, providers, router, PWA, theme
├── config/         OIDC config fetch
├── features/       Feature modules (today, calendar, medication, etc.)
├── lib/
│   ├── api/        Typed fetch functions + Zod schemas
│   ├── auth/       OIDC token bridge
│   └── query/      TanStack QueryClient + query key factory
├── i18n/           Paraglide language provider
├── mocks/          MSW mock layer (browser + node)
│   ├── browser.ts  setupWorker (browser demo mode)
│   ├── server.ts   setupServer (Vitest)
│   ├── MockAuthProvider.tsx
│   ├── handlers/   Per-domain request handlers
│   └── data/       Typed seed data + resettable state
└── types/          Shared TypeScript types
tests/
├── features/       Component tests (dom project)
├── lib/            API + utility tests (node project)
├── msw/            MSW-backed integration tests (msw project)
└── utils/          QueryTestProvider, router helpers
```
