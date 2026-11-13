# uv comes from its own FROM stage, not `COPY --from=<image>`: Dependabot's docker updater only reads
# FROM lines (dependabot/dependabot-core#5103), so this is what lets it propose uv bumps.
FROM ghcr.io/astral-sh/uv:0.13.8@sha256:5cc1805e2426484abca4ad46ea783bab281fdb225fd82d8ce6d66a81254bac85 AS uv

FROM python:3.15-slim AS builder
ARG BUILD_VERSION=dev

COPY --from=uv /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.15-slim

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY . .

ARG APP_COMMIT=unknown
ENV APP_COMMIT=${APP_COMMIT}

ENV PATH="/app/.venv/bin:$PATH"

RUN groupadd --gid 1000 appgroup \
    && useradd --uid 1000 --gid appgroup --shell /bin/bash --no-create-home appuser \
    && chown -R appuser:appgroup /app

USER appuser

ARG BUILD_VERSION=dev
ENV BUILD_VERSION=${BUILD_VERSION}
ENV ENVIRONMENT=production

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
