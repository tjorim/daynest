# Daynest

Daynest is a personal web app for managing daily routines, chores, medication, and household planning across phone and laptop.

It combines a **today-focused checklist** with a **calendar overview**, and is designed to integrate later with **Home Assistant** and AI tooling via an MCP-compatible adapter.

## Why the name “Daynest”?

“Daynest” combines:

- **Day**: your daily flow (today view, routines, medication, chores)
- **Nest**: your home base, where household planning lives without becoming bloated

The name reflects the product goal: a calm place to organize everyday life at home.

## Goals

- Keep today clear and actionable.
- Avoid forgetting recurring chores.
- Track medication reliably.
- Work well on Android and desktop.
- Stay simple enough for one person to build and maintain.
- Support future integrations without redesigning core logic.

## Tech stack (planned)

- Frontend: React, TypeScript, Vite, Bootstrap, dayjs
- Native Android: Kotlin, Jetpack Compose, AndroidX
- Backend: FastAPI, SQLAlchemy/SQLModel, PostgreSQL, Alembic, Pydantic
- Hosting: Docker Compose on a VPS, Caddy reverse proxy

## Product principles

- Today screen is the default and primary interaction point.
- Calendar is an overview/planning layer, not the only workflow.
- Medication is modeled more strictly than standard tasks.
- Completing tasks should be frictionless.
- Recurrence should be powerful but understandable.
- Integrations should reuse core services instead of duplicating logic.
- Growth areas should be optional modules layered on top of planning, not required complexity for core daily use.

## Initial architecture layout

```text
frontend/
  src/
    app/
      router/
      layout/
      providers/
    components/
      common/
      forms/
      calendar/
    features/
      today/
      routines/
      chores/
      medication/
      planning/
      settings/
    domain/
      routines/
      chores/
      medication/
      planning/
      today/
    lib/
      api/
      dates/
      storage/
      utils/
    hooks/
    types/

backend/
  app/
    api/
      routes/
    core/
    db/
    models/
    schemas/
    services/
    repositories/
    jobs/
    integrations/
  alembic/

android/
  app/
    src/main/
      java/com/test/nativeapp/
      res/
```

## Roadmap

1. Foundation: scaffold app, auth skeleton, migrations, recurrence/date utilities.
2. Routines + Today: recurring routine templates and daily task instances.
3. Chores: recurring/one-off chores, overdue and reschedule support.
4. Medication: plan + dose generation + history.
5. Calendar + planned items: month/day detail and unified daily read model.
6. Polish: PWA installability, caching, export/import.
7. Integrations: Home Assistant and thin MCP adapter.
8. Optional growth modules:
   - Shopping lists
   - Meal planning
   - Recurring groceries/inventory hooks
   - Shared calendar/planning linkage

## Optional growth modules (implemented as metadata, not separate silos)

Planned items can now carry optional `module_key` and link metadata so Daynest can grow into shopping,
meal planning, recurring grocery reminders, and shared calendar linkage without creating new mandatory workflows.

Current module keys:

- `shopping_list`
- `meal_planning`
- `recurring_grocery`
- `shared_calendar`

Optional linkage fields on planned items:

- `recurrence_hint` (simple reminder cadence hint)
- `linked_source` (e.g. external calendar/inventory source)
- `linked_ref` (external record/event identifier)

If these fields are omitted, planned items remain plain and simple.

## Why this direction

This architecture keeps Daynest calm, lightweight, and practical while preserving a clean path for future integrations and automation.


## Practical next suggestions

1. Add first migrations and real SQLAlchemy models for `User`, `RoutineTemplate`, and `TaskInstance`.
2. Implement `GET /api/v1/today` as the first real read model and drive the Today UI from it.
3. Add lightweight auth (`/auth/login`, `/auth/refresh`, `/auth/me`) before writing chore/medication mutations.
4. Add basic CI checks (`python -m py_compile`, `npm run build`) to prevent scaffold regressions.
5. Add a service worker for shell caching once Today + Calendar routes are stable.

## App name suggestions

If you want alternatives to **Daynest**, here are options grouped by tone:

- **Calm/homey**: Daynest, Hearthlist, Nestday, Homeday
- **Practical/task-focused**: TidyTick, Chorepath, Routinest, Plainplan
- **Medication-forward**: Dosepath, Medinest, DailyDosebook
- **Planning-forward**: Daygrid, Planstead, Weeknest

Top 3 recommendations for your product direction:

1. **Daynest** (best balance of personal + practical)
2. **TidyTick** (more task-centric, playful)
3. **Planstead** (planning-oriented, calm tone)


## Integration-ready API surface

Daynest now exposes thin integration adapters over the existing `TodayService` read models,
with scoped integration keys and per-client rate limits:

- Integration client management (user bearer auth):
  - `POST /api/v1/integrations/clients` (returns one-time API key)
  - `GET /api/v1/integrations/clients`
- Home Assistant adapter (requires `X-Integration-Key` + `ha:read` scope):
  - `GET /api/v1/integrations/home-assistant/summary`
  - `GET /api/v1/integrations/home-assistant/entities`
  - `GET /api/v1/integrations/home-assistant/dashboard`
- MCP adapter (requires `X-Integration-Key` + `mcp:read` scope):
  - `GET /api/v1/mcp/capabilities`
  - `GET /api/v1/mcp/today`
  - `GET /api/v1/mcp/calendar/day?date=YYYY-MM-DD`

The adapters intentionally avoid duplicate business logic and call shared services/repositories.

Integration contracts are explicitly versioned via the `X-Integration-Contract` response header:

- Home Assistant: `home-assistant; version=ha.v1`
- MCP: `mcp; version=mcp.v1`

Compatibility and schema evolution documentation:

- `backend/docs/integrations/COMPATIBILITY_POLICY.md`
- `backend/docs/integrations/SCHEMA_CHANGELOG.md`
- `backend/docs/integrations/HOME_ASSISTANT_CUSTOM_INTEGRATION_PLAN.md`

## Runtime hardening and environment-specific config

### Environment files

Backend runtime configuration is split by environment:

- `backend/env/dev.env`
- `backend/env/staging.env`
- `backend/env/prod.env`

Select the backend env file at deploy time:

```bash
BACKEND_ENV_FILE=./backend/env/staging.env docker compose up -d
```

### Managed secret injection

Do not store app/database secrets in env files. The stack reads them from container secret files:

- `JWT_SECRET_FILE` -> `/run/secrets/jwt_secret`
- `DB_PASSWORD_FILE` -> `/run/secrets/postgres_password`

Compose secret file locations are chosen at runtime:

```bash
JWT_SECRET_FILE_PATH=./secrets/staging/jwt_secret.txt \
POSTGRES_PASSWORD_FILE_PATH=./secrets/staging/postgres_password.txt \
BACKEND_ENV_FILE=./backend/env/staging.env \
docker compose up -d
```

### CORS and trusted hosts

Configure these per environment via env files:

- `CORS_ALLOW_ORIGINS` (comma-separated)
- `TRUSTED_HOSTS` (comma-separated)

### DB/network exposure by environment

- Base `docker-compose.yml` keeps Postgres internal-only (`expose` only).
- Local development can opt into host DB access by layering `docker-compose.dev.yml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Data loss prevention playbook

To reduce painful data loss, Daynest treats backup/recovery and data portability as first-class operational requirements.

### 1) Postgres backup policy + restore drill

**Backup policy**

- **Nightly full logical backup** using `pg_dump -Fc` from the running Postgres service.
- **Retention:** keep daily backups for 14 days, weekly backups for 8 weeks, and monthly backups for 12 months.
- **Storage:** write to encrypted object storage (or equivalent off-host storage) plus a short-term local cache for fast restores.
- **Naming convention:** `daynest_<env>_<YYYYMMDD_HHMMSS>.dump`.
- **Ownership:** backup job runs from infra automation; failures page on-call and create an issue.

**Restore drill (required)**

- Run a **monthly restore drill** in a disposable environment using the latest nightly backup.
- Verify:
  1. Database can be restored without manual intervention or schema adjustments.
  2. API health endpoint and auth login work post-restore.
  3. Row-count sanity checks pass for critical tables (`users`, `routine_templates`, `task_instances`, `planned_items`, `medication_plans`, `medication_dose_instances`).
- Publish a short drill report with:
  - backup artifact used,
  - recovery time objective achieved (actual minutes),
  - data validation findings,
  - follow-up actions.

### 2) Export/import compatibility contract + versioning

Daynest export files must be **self-describing** and versioned.

- Top-level required fields (current v1 schema, see `PlannedItemBackupFile` in `frontend/src/lib/api/today.ts`):
  - `exported_at`: ISO-8601 UTC timestamp
  - `source`: `"daynest"`
  - `schema_version`: `1` (integer literal)
  - `items`: array of planned-item objects
- Contract rules:
  - **Backward-compatible imports** within the same major export version.
  - Importers must ignore unknown additive fields.
  - Breaking export format changes require **major** version bump.
  - New optional fields require **minor** version bump.
  - Metadata-only/cosmetic corrections require **patch** bump.
- Import endpoint/process should support a `--dry-run`/validation mode that reports:
  - version compatibility,
  - unknown required fields,
  - foreign-key/reference integrity issues,
  - per-entity counts to be created/updated/skipped.

### 3) Migration rollback guidelines

Alembic migrations should be written with safe rollback strategy in mind.

- Every revision must define both `upgrade()` and `downgrade()`.
- Favor **expand-and-contract** migration patterns for production:
  1. Additive schema changes first (new nullable columns/tables/indexes).
  2. Dual-write/read compatibility in app layer if needed.
  3. Backfill data in controlled batches.
  4. Flip reads/writes to new schema.
  5. Remove old columns/tables in a separate, subsequent release.
- For destructive operations, require:
  - explicit pre-migration backup confirmation,
  - rollback notes in PR description,
  - tested downgrade on staging snapshot before production apply.
- Never combine major schema reshaping and unrelated feature work in one migration revision.

### 4) Seed/snapshot strategy for local + staging parity

Use both deterministic seeds and sanitized snapshots, each for a different purpose.

- **Deterministic seed data** (committed scripts):
  - minimal baseline users/templates/items for fast local setup,
  - stable IDs/names where possible to keep frontend/API tests predictable,
  - safe for CI and developer onboarding.
- **Sanitized staging snapshot** (scheduled refresh):
  - periodic import from production-like data with PII/token stripping,
  - preserves realistic relational shape, recurrence patterns, and historical ranges,
  - used for migration rehearsals, performance checks, and export/import validation.
- Operating rule:
  - local dev defaults to deterministic seed,
  - staging defaults to latest approved sanitized snapshot,
  - snapshot refresh procedure includes automatic smoke tests before marking usable.

## Operational visibility

The backend includes baseline observability primitives for production operations:

- Structured request logging with `request_id`, `user_id` (when available), route, status, and latency.
- Health split endpoints:
  - `GET /api/v1/health/liveness` (process alive)
  - `GET /api/v1/health/readiness` (dependency readiness via DB ping)
- Minimal JSON metrics at `GET /api/v1/metrics`:
  - total request count
  - total 5xx error count and error rate
  - request rate and latency stats
- Optional Sentry error tracking/tracing when `SENTRY_DSN` is set.

Related backend environment variables:

- `LOG_LEVEL` (default `INFO`)
- `SENTRY_DSN` (optional)
- `SENTRY_TRACES_SAMPLE_RATE` (default `0.0`)

## CI safety automation

GitHub Actions now enforces non-feature safety checks on pull requests and pushes to `main` via `.github/workflows/ci-safety.yml`:

- `backend-safety` (lint, type-check, tests)
- `frontend-type-build` (TypeScript compile + production build)
- `migration-check` (`alembic upgrade head` + `alembic check` against Postgres)
- `container-build-verification` (builds both backend and frontend Dockerfiles)

Branch protection is automated in `.github/workflows/branch-protection.yml` and requires those checks to be green before merge.

If `GITHUB_TOKEN` cannot administer branch settings in your repo, create a `BRANCH_PROTECTION_TOKEN` secret with a fine-grained personal access token that has "Administration" repository permissions (read and write).

## Backend Python tooling

The backend uses Astral tooling throughout:

| Tool | Role |
|------|------|
| [uv](https://docs.astral.sh/uv/) | Environment and dependency management |
| [Ruff](https://docs.astral.sh/ruff/) | Linting and formatting |
| [ty](https://github.com/astral-sh/ty) | Type checking (replaces mypy) |

**Why ty over mypy?**

- Completes the all-Astral toolchain (uv + Ruff + ty).
- Significantly faster than mypy (10–100×), even on small codebases.
- No mypy-specific plugins are used in this project, so migration is clean.
- `ty` is in beta as of 0.0.x; false positives from incomplete third-party stubs
  (e.g. `anyio.to_thread`) are suppressed via `[tool.ty.rules]` in `pyproject.toml`.

Run type-checking locally:

```bash
cd backend
uv run ty check app
```
