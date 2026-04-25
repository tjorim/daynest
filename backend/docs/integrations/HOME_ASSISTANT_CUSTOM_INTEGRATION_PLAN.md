# Home Assistant custom integration plan (blueprint-first)

## Context in this repo

Daynest already exposes a thin Home Assistant adapter in the backend API:

- `GET /api/v1/integrations/home-assistant/summary`
- `GET /api/v1/integrations/home-assistant/entities`
- `GET /api/v1/integrations/home-assistant/dashboard`

These routes already enforce scoped integration auth (`ha:read`) and emit a versioned contract header, which gives us a stable base to build a real Home Assistant custom integration on top of.

## Template review

I reviewed these two blueprints as requested:

1. `ludeeus/integration_blueprint`
2. `jpawlowski/hacs.integration_blueprint`

### What stands out in `ludeeus/integration_blueprint`

- Battle-tested, minimal baseline for Home Assistant custom components.
- Standard Home Assistant folder structure and naming conventions.
- Straightforward onboarding steps (rename placeholders, run `scripts/develop`, add tests).
- Good option if we want the least opinionated starting point.

### What stands out in `jpawlowski/hacs.integration_blueprint`

- More modern and opinionated developer workflow:
  - one-shot `initialize.sh` with domain/title/repo replacement,
  - script-driven DX (`script/develop`, `script/test`, `script/check`, etc.),
  - pre-commit + Ruff + Pyright,
  - package-based architecture for scalability,
  - HACS-first setup and docs.
- Explicitly targets recent Home Assistant versions and includes a stronger documentation footprint for maintainability.

## Recommendation

Use `jpawlowski/hacs.integration_blueprint` as the base, while selectively copying minimal conventions from `ludeeus/integration_blueprint` where simpler is better.

Rationale:

- We plan to maintain this long-term and iterate quickly.
- Daynest already has a backend integration contract; the bigger risk is maintainability and release hygiene, not API uncertainty.
- The modern tooling in `jpawlowski` lowers maintenance overhead and encourages consistent quality checks.

## Proposed architecture for Daynest Home Assistant integration

### Integration repository (new repo)

Create a dedicated repo, for example:

- `daynest-home-assistant`

Domain proposal:

- `daynest`

Core runtime pieces:

- `custom_components/daynest/manifest.json`
- `custom_components/daynest/__init__.py`
- `custom_components/daynest/config_flow.py`
- `custom_components/daynest/coordinator.py`
- `custom_components/daynest/sensor.py`
- `custom_components/daynest/todo.py` (optional in phase 2)
- `custom_components/daynest/api.py` (async HTTP client over Daynest backend via `aiohttp`, no blocking calls)

### Data flow

1. User configures integration with Daynest base URL + integration API key.
2. Config flow validates credentials against `.../integrations/home-assistant/summary`.
3. A `DataUpdateCoordinator` fetches dashboard data on schedule.
4. Entities map Daynest read models to Home Assistant entities:
   - Sensors:
     - overdue count
     - completion ratio
     - next medication
   - To-do entity:
     - tasks due today (phase 2)

### Home Assistant async requirement (must-have)

- All network I/O must be asynchronous and event-loop safe.
- Use Home Assistant's `aiohttp` session helpers (e.g., `async_get_clientsession`) in `api.py`; do **not** use blocking libraries such as `requests`.
- Coordinator refreshes should run in `async_update_data` and await API calls directly.
- Treat blocking-call warnings as release blockers, because they can degrade HA responsiveness/stability.

### Contract and compatibility strategy

- Treat Daynest response shape as an external contract.
- Require and log `X-Integration-Contract` to verify expected version.
- Gracefully degrade if optional fields are missing.
- Pin minimum backend contract version in integration constants.

## Delivery plan

### Phase 0 — Scaffold (1 day)

- Generate a new repo from `jpawlowski/hacs.integration_blueprint`.
- Run initialization with:
  - domain: `daynest`
  - title: `Daynest`
  - repo metadata + maintainer info
- Confirm dev loop works (`script/develop`, `script/test`, `script/check`).

### Phase 1 — Read-only MVP (2–4 days)

- Implement API client for `/summary` and `/dashboard`.
- Add coordinator and 3–4 sensor entities.
- Add config flow for base URL + API key.
- Add robust error mapping (`ConfigEntryNotReady`, auth errors, timeout errors).
- Add tests for config flow, coordinator refresh, and entity state mapping.

### Phase 2 — Better HA UX (2–3 days)

- Add to-do platform mapping for Daynest tasks due today.
- Add diagnostics endpoint support (redacted).
- Add device/entity metadata polish (icons, categories, attribution).
- Add services if needed (e.g., refresh now).

### Phase 3 — Distribution + lifecycle (1–2 days)

- Validate HACS metadata and release pipeline.
- Publish first release.
- Add CHANGELOG + migration notes.
- Add compatibility matrix between integration version and backend contract version.

## Immediate next actions in this repo

To prepare Daynest backend for a clean custom integration launch:

1. Add explicit API examples for HA adapter payloads in docs.
2. Add integration-focused tests that lock the JSON response shape for:
   - `/summary`
   - `/entities`
   - `/dashboard`
3. Add a short “How to connect from Home Assistant custom integration” guide with API key scope requirements.

## Risks and mitigations

- **Contract drift** between backend and integration:
  - Mitigation: schema contract tests + explicit version header checks.
- **User setup friction** (URL/auth confusion):
  - Mitigation: stricter config-flow validation and clear error messages.
- **HA release churn**:
  - Mitigation: keep CI/testing up to date with supported HA versions and merge upstream blueprint improvements regularly.

## Definition of done (MVP)

- Installable via HACS custom repository.
- Config flow succeeds against a Daynest backend instance with `ha:read` key.
- Sensors populate from `/dashboard` and `/summary` without template YAML.
- Automated tests cover config flow + coordinator + entity mappings.
- README includes setup, troubleshooting, and compatibility notes.
