# Daynest backend

FastAPI + SQLAlchemy service behind the Daynest web app, Android app, Home Assistant integration and MCP clients. It
serves the REST API under `/api`, an MCP server mounted at `/mcp`, and the OpenAPI document the frontend's API types are
generated from.

## Setup

Requirements: [uv](https://docs.astral.sh/uv/) (it installs the Python version from `.python-version`).

```bash
cd backend
uv sync --locked          # creates .venv with the runtime and dev dependencies
```

Configuration comes from environment variables; `env/dev.env`, `env/staging.env` and `env/prod.env` hold the
per-environment defaults used by Docker Compose and `.env.example` lists the variables. Secrets are read from files
(`JWT_SECRET_FILE`, `DB_PASSWORD_FILE`, ...), never stored in env files; see the repository README for the compose setup.

## Run

With `ENVIRONMENT=dev` (the default) and no `DATABASE_URL` the backend uses a SQLite file, `dev.db`, built from the
models instead of the migrations:

```bash
export DEV_AUTH_BYPASS_TOKEN=dev        # any string; send it as `Authorization: Bearer dev`
uv run python -m app.db.dev_schema      # create the tables (--reset rebuilds the file after a model change)
uv run uvicorn app.main:app --reload
```

For PostgreSQL and Keycloak start the local stack from the repository root with `docker compose up -d`.

## Test

```bash
uv run pytest
```

The suite uses an in-memory SQLite database and needs no services. Async tests are marked `@pytest.mark.anyio`.
`tests/test_openapi_snapshot.py` fails when `../frontend/openapi.json` is stale (see "API contract").

## Lint and type-check

```bash
uv run ruff check .
uv run ruff format --check .     # `uv run ruff format .` to rewrite
uv run ty check .
```

## Migrations

Alembic revisions live in `alembic/versions/`. The database URL is `DATABASE_URL` when set; otherwise, with the
default `ENVIRONMENT=dev`, the backend uses a local SQLite file (`dev.db`) and ignores `DB_*`. The `DB_*` variables only
select PostgreSQL outside the dev environment, so for PostgreSQL migrations in development export a `DATABASE_URL`
first (for example `postgresql+psycopg://user:password@localhost:5432/daynest`).

```bash
export DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/daynest   # PostgreSQL target
uv run alembic upgrade head      # apply migrations
uv run alembic check             # fail when the models and migrations disagree
uv run alembic revision --autogenerate -m "describe the change"
```

Never edit an applied revision. Production runs on PostgreSQL, so verify schema changes there rather than on the
SQLite development database.

## API contract

The response models are the source of truth for the frontend's API types:

```bash
uv run python -m app.openapi_export   # writes ../frontend/openapi.json (run `pnpm api:generate` in frontend/ for the types)
```

See "API contract" in the repository's `AGENTS.md` for the full workflow, and [SCHEMA-CONVENTIONS.md](SCHEMA-CONVENTIONS.md)
for the schema rules.

## More documentation

- [Observability](docs/OBSERVABILITY.md), [profiling](docs/PROFILING.md) and [rate limiting](docs/RATE_LIMITING.md)
- Integration contracts: [compatibility policy](docs/integrations/COMPATIBILITY_POLICY.md), [schema changelog](docs/integrations/SCHEMA_CHANGELOG.md), [local MCP server](docs/integrations/LOCAL_MCP_SERVER.md)
