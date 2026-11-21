# AGENTS.md

## Project overview

Daynest is a personal web app for daily routines, chores, medication and household planning: a React 19 + Vite +
TypeScript 7 single-page app (`frontend/`), a FastAPI + SQLAlchemy backend (`backend/`) whose OpenAPI document drives
the frontend's generated API types, a native Android app (`android/`), a Pebble companion (`pebble/`), a Home Assistant
integration (`custom_components/`, `dashboard/`) and the `python-daynest` client library. Toolchain versions live in
`frontend/.node-version`, the `packageManager` field of `frontend/package.json` and `backend/pyproject.toml`; see
`docs/toolchain.md`.

## Repository layout

- `frontend/` contains the web app (`src/`, unit tests in `tests/`, Playwright specs in `e2e/`, translations in `messages/`)
- `backend/` contains the FastAPI service (`app/`, `alembic/`, `tests/`, per-environment files in `env/`)
- `android/` contains the native Android app; `pebble/` the Pebble watch app
- `custom_components/` contains the Home Assistant integration, `dashboard/` its Lovelace card and `python-daynest/` the PyPI client library
- `docs/ARCHITECTURE.md` describes the source layout shared by the four apps (`app/`, `features/<domain>/`, `components/`, `lib/` ...)
- `docs/` holds contracts, decisions and maintenance guides; `scripts/` the release tooling; `secrets/` the (git-ignored) compose secret files
- `docker-compose.yml` is the local development stack (PostgreSQL and Keycloak); production runs elsewhere with the same images

### Source of truth

- `VERSION` (repo root) for the app version, see "Release"
- `backend/` for API shapes: `frontend/openapi.json` is the committed OpenAPI document (`uv run python -m app.openapi_export`), `frontend/src/api-schema/` is generated from it by Orval and `frontend/src/api-types.ts` is the one place screens import API types from
- `frontend/messages/` for translation content
- `backend/SCHEMA-CONVENTIONS.md` for backend schema conventions

## Commands

### Frontend (`cd frontend`)

```bash
pnpm install --frozen-lockfile
pnpm dev                 # needs a running backend and Keycloak; `pnpm dev:mock` runs against MSW instead
pnpm typecheck           # paraglide:compile + api:check + fixtures:check + tsc -b --noEmit
pnpm lint
pnpm format              # rewrites files in place
pnpm format:check        # what CI runs
pnpm format:repo         # same for ../.github, ../scripts and the root JSON files (format:repo:check in CI)
pnpm test                # Vitest; test:watch for watch mode
pnpm test:e2e            # Playwright against the mocked frontend (builds with MSW baked in)
pnpm build               # build:mock builds with the MSW service worker
pnpm bundle:check        # bundle budgets (bundle:report prints them, bundle:test tests the script)
pnpm locale:audit        # interface strings and catalogues
pnpm check-message-parity
pnpm paraglide:compile   # regenerates src/paraglide (git-ignored)
pnpm api:generate        # rewrites openapi.json (needs uv) and src/api-schema/
pnpm api:check           # fails when src/api-schema/ is stale against openapi.json
pnpm ui:check            # UI maintenance inventory (ui:test, ui:usage, ui:upstream, ui:diff, ui:record)
pnpm test:compatibility  # native-React vs Redact runtime checks
```

### Backend (`cd backend`)

```bash
uv sync --locked
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check .
uv run ruff format --check .      # ruff format . to rewrite
uv run ty check .
uv run alembic upgrade head       # PostgreSQL; alembic check verifies migrations match the models
uv run python -m app.openapi_export   # rewrites ../frontend/openapi.json
uv run python -m app.db.dev_schema    # SQLite dev database from the models (--reset rebuilds it)
```

## Conventions

### Code style

- Frontend formatting is `oxfmt`, linting `oxlint` (with `@shadcn/lint`); backend formatting and linting is `ruff` (line length 120, rules `E, F, I, UP, B, C4, SIM`) and type checking `ty`. Do not add another formatter or linter.
- Use `pnpm` only (one lockfile per package: `frontend/` and `dashboard/`) and `uv` only for Python. `minimumReleaseAge: 1440` in `pnpm-workspace.yaml` keeps the one-day quarantine for new releases: wait for a release to mature instead of disabling it.
- TypeScript runs with `erasableSyntaxOnly` and `verbatimModuleSyntax`: no enums, namespaces or parameter properties; use `import type` for types. `@/` maps to `frontend/src/`.
- Backend dependencies are pinned exactly (`==`) in `backend/pyproject.toml`; frontend ranges use `^x.y.z`. Update lockfiles with `pnpm install --lockfile-only` and `uv lock`, never by hand.

### Styling and UI

- Use unprefixed Tailwind v4 utilities (`px-4`, `dark:bg-popover`, `max-w-lg`). Bootstrap and its icon font have been removed; do not add their packages or classes.
- `frontend/src/styles/tailwind.css` owns tokens, document defaults and custom utilities. The cascade is `theme, base, schedule-x, components, utilities`; import vendor styles into a named layer below utilities. The owned base layer preserves the existing typography and native controls, so do not add a second reset or preflight without comparing every screen.
- `dark:` follows `data-theme="dark"` on `<html>`, set by `ThemeProvider`. This is the only theme switch: never add a `prefers-color-scheme` media query. Use semantic `--color-*` tokens; the calendar follows `calendar.setTheme(resolvedTheme)`.
- Write new shared controls in `src/components/ui/` with Base UI primitives, Tailwind and `cn` from `@/lib/utils`. Before implementing or restyling UI, check the shared controls, the configured Base UI shadcn registry equivalents and official docs; record keep/extend/replace and consumer coverage in [the coverage audit](docs/ui-registry-coverage.md). Check existing controls first: buttons, alerts, badges, cards, fields, form inputs, lists, tables, progress, spinners and dialogs are already available. Icons use `lucide-react`; keep decorative icons hidden from assistive technology and label icon-only controls.
- `components.json` pins `base-nova` and Lucide; `ui-maintenance.json` stays in `base-ui` mode. Inventory hand-written components as described in `docs/ui-maintenance.md`.
- `pnpm lint` enforces no arbitrary values, raw palette colours, inline styles or unknown classes, with no class allow-list. Define named one-off sizes/styles with `@utility` in `tailwind.css`. Pass dynamic values through CSS custom properties.
- Compare changed views against `main` in light/dark at 1280px and 390px. Preserve the documented breakpoints, native-control sizes and keyboard interactions.
- Use `pnpm` only. Each package has a single lockfile: `frontend/pnpm-lock.yaml` and `dashboard/pnpm-lock.yaml`.

### UI dependency maintenance

Follow [docs/ui-maintenance.md](docs/ui-maintenance.md) for Base UI/runtime updates and direct dialog maintenance. Run `pnpm ui:check` from `frontend/` after changing shared UI. Renovate does not update owned component source; preserve the documented customisations and validate interactions and bundle budgets.

Application UI imports use `@/components/ui/<component>`. Direct Base UI subpath imports belong in inventoried UI adapters or exact documented composition exceptions. `pnpm ui:check` enforces the policy; `pnpm ui:test` tests it. Keep styles and application behaviour when aligning imports.

### Tests

- Frontend unit tests live in `frontend/tests/` (Vitest projects `dom`, `node`, `scripts` and `msw`, see `frontend/vitest.config.ts`); `frontend/scripts/*.test.mjs` test the repo scripts. Browser specs live in `frontend/e2e/`.
- Backend tests live in `backend/tests/` and use an in-memory SQLite database; async tests use `@pytest.mark.anyio`.
- Every JSON fixture in a test is typed with a generated API record (see "API contract").

### Internationalisation

- UI text lives in `frontend/messages/{en,nl}.json` and is compiled by Paraglide into `frontend/src/paraglide/` (git-ignored; `pnpm typecheck` and `pnpm build` compile it). Use `m.<key>()` from `@/paraglide/messages`; never hard-code interface strings.
- `pnpm locale:audit` and `pnpm check-message-parity` keep both catalogues complete and in step.

## API contract

The backend's response models are the source of truth for the frontend's API types, and nothing in between is written by hand:

```text
backend response models -> uv run python -m app.openapi_export (pnpm api:generate)
  -> frontend/openapi.json -> Orval (frontend/orval.config.mjs) -> frontend/src/api-schema/
  -> frontend/src/api-types.ts (the one import point for API shapes)
```

- `frontend/openapi.json` is a committed snapshot of the backend's OpenAPI document with `info.version` pinned to
  `"snapshot"`, so a release bump never stales it. `frontend/src/api-schema/` is generated from it, one file per
  schema. Never hand-edit either, and do not declare an API record type anywhere else in the frontend.
- To add or change an endpoint: give the route a `response_model` (a test enforces it; a response model derives from
  `ResponseModel` in `backend/app/schemas/base.py` so a field with a default is required in the generated type), run
  `pnpm api:generate` in `frontend/` (it needs `uv`), commit `openapi.json` and `src/api-schema/`, and alias the
  generated record for the screens in `frontend/src/api-types.ts`.
- `pnpm typecheck` runs `pnpm api:check` and fails when `src/api-schema/` is stale; the backend test
  `test_openapi_snapshot` fails when `openapi.json` is stale. `backend/tests/test_response_models.py` fails on a JSON
  route without a documented response schema, and on an optional response field without a documented reason (it
  rejects both new unexplained fields and stale exceptions). Request optionality is a separate contract.
- Do not use `openapi-typescript` or `@hey-api/openapi-ts`: both call the TypeScript 5 compiler API and fail under
  TypeScript 7.
- Fixtures: every successful JSON response in MSW handlers, fetch doubles and browser specs is typed with a generated
  record, `jsonResponse<GeneratedResponse>` from `@/mocks/response`. `pnpm typecheck` type-checks `src`, `tests` and
  `e2e`, runs the negative compile probes (`tests/types/fixtureContracts.compile.ts`) and the source guard
  (`pnpm fixtures:check`), which fails on an unchecked or erased fixture. A fixture that is deliberately not a success
  record (an error envelope, an empty stream) carries an inline `/* Fixture exception: <reason> */` comment; see
  `frontend/src/mocks/README.md`.

## Testing

Run the checks CI runs before pushing, from `frontend/`: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` (+ `pnpm format:repo:check`), `pnpm test`, `pnpm build`, `pnpm bundle:test && pnpm bundle:check`, `pnpm locale:audit`, `pnpm check-message-parity` and `pnpm ui:test && pnpm ui:check`; from `backend/`: `uv run ruff check .`, `uv run ruff format --check .`, `uv run ty check .` and `uv run pytest --cov`. CI runs `pnpm test --coverage` and `pytest --cov` with floors just below the measured totals (`vitest.config.ts`, `[tool.coverage.report]`): raise them as tests are added, never lower them to land a change. `pnpm test:e2e` needs `pnpm exec playwright install chromium`. Other components have their own checks (`android/`, `pebble/`, `custom_components/`, `python-daynest/`, `dashboard/`); see their workflows.

## CI

`.github/workflows/ci.yml` detects which components a change touches and calls the component workflows (`backend-ci.yml`, `frontend-ci.yml`, `dashboard-ci.yml`, `daynest-lib-ci.yml`, `ha-ci.yml`, `android.yml`, `pebble.yml` and the `codeql-*.yml` scans); unchanged components show as skipped. The `CI gate` job fails when any needed job failed or was cancelled. The frontend workflow runs `Frontend / Checks` and `Frontend / E2E Tests (Chromium)`; the backend workflow runs `Backend / Checks` and `Backend / Migrations` (the calling jobs in `ci.yml` supply the `Frontend` and `Backend` prefix, so the jobs inside the called workflows must not repeat it). `ci.yml` also checks release metadata and the formatting of workflows, scripts and root JSON. Action versions are pinned to commit SHAs with the version in a comment; Renovate keeps them current.

## Release

The app uses CalVer, `YYYY.M.MICRO` (`MICRO` counts releases within a month), tagged `vYYYY.M.MICRO`. The
root `VERSION` file is the single source of truth; `release.config.json` lists the files that carry a
checked-in copy (`frontend/package.json`, `dashboard/package.json`, `custom_components/daynest/manifest.json`, `python-daynest/`).
`android/app/build.gradle.kts` reads `VERSION` at build time and must never be hand-edited. Its
`versionCode` is `MAJOR × 1000000 + MINOR × 1000 + PATCH` of `YYYY.M.MICRO` (`v2026.7.1` → `2026007001`).

`python-daynest` (PyPI) follows the same CalVer: `python-daynest/pyproject.toml`, `python-daynest/uv.lock`
and the `python-daynest==` pin in `manifest.json` are also listed in `release.config.json`, so `bump`
and `check` keep them equal to `VERSION`. Every app tag therefore publishes a new library version. The
release workflow skips the PyPI upload only when that version is already published (re-running a tag).
Releases up to `0.1.12` used independent SemVer (#673); CalVer versions sort above them.

1. Add entries under `## [Unreleased]` in `CHANGELOG.md` while working (`### Added`, `### Changed`,
   `### Fixed`, `### Removed`). Put backend, infrastructure, CI and dependency changes under `### Internal`:
   apps hide that heading from users. Prefix a bullet with `**Android:**` (any scope in
   `release.config.json`) when it only applies to one client.
   `node scripts/release.mjs export --audience app --platform android` prints what an app should show.
2. `node scripts/release.mjs bump` writes the next version into `VERSION` and every file above and turns
   `[Unreleased]` into the dated release section with compare links. Review the diff, open the release PR
   and merge it.
3. Push tag `vYYYY.M.MICRO`. `.github/workflows/release.yml` re-checks the tag, versions and changelog
   (`node scripts/release.mjs check --tag`), publishes `python-daynest` if needed, builds the HACS archive
   and Android APK, and creates a **draft** GitHub release whose notes are the changelog section.

`node scripts/release.mjs check` also runs in CI on every pull request.

## Pitfalls

- Never hand-edit `frontend/openapi.json` or `frontend/src/api-schema/`; regenerate them, and do not declare API record types elsewhere in the frontend.
- `frontend/src/paraglide/` is generated and git-ignored: run `pnpm paraglide:compile` (or `pnpm typecheck`) after a fresh checkout before running `tsc` or Vitest directly.
- `pnpm install` runs `msw init` (postinstall), which generates `frontend/public/mockServiceWorker.js`; the file is gitignored, never commit it.
- `ENVIRONMENT=dev` without a `DATABASE_URL` uses a SQLite file built from the models, not from the migrations; production is PostgreSQL, so verify schema changes with `alembic upgrade head` and `alembic check` against PostgreSQL.
- `android/app/build.gradle.kts` reads `VERSION`; never edit the version there by hand.
- `openapi-typescript` and `@hey-api/openapi-ts` fail under TypeScript 7; the API types come from Orval only.
- Keep `.github/` workflows, `scripts/` and the root JSON files formatted with `pnpm format:repo` (CI runs `format:repo:check`).
