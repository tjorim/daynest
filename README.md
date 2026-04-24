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
