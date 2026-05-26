import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastmcp.utilities.lifespan import combine_lifespans
from starlette.applications import Starlette

from app.api.routes.auth import close_http_client as close_auth_http_client
from app.api.routes.auth import router as auth_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.bulk import router as bulk_router
from app.api.routes.calendar import router as calendar_router
from app.api.routes.households import router as households_router
from app.api.routes.search import router as search_router
from app.api.routes.health import router as system_router
from app.api.routes.integrations.clients import router as integration_clients_router
from app.api.routes.integrations.home_assistant import router as home_assistant_router
from app.api.routes.medications import router as medications_router
from app.api.routes.push import router as push_router
from app.api.routes.templates import router as templates_router
from app.api.routes.today import router as today_router
from app.api.routes.users import router as users_router
from app.api.dependencies.events import get_event_bus
from app.core.config import settings
from app.core.observability import configure_error_tracking, configure_logging, observability_middleware
from app.db.session import SessionLocal
from app.mcp_server import create_mcp_server
from app.models.user import User
from app.services.event_bus import EventBus
from app.services.push_service import (
    close_http_client as close_push_http_client,
    dispatch_medication_reminders,
    dispatch_missed_medications,
    dispatch_overdue_chores,
    pending_push_user_ids,
)

configure_logging()
configure_error_tracking()


class _MCPAwareCORSMiddleware:
    """CORS middleware that skips /mcp paths.

    fastmcp handles CORS for its own OAuth .well-known routes; a second CORS
    layer on those paths causes 404s on preflight requests.
    """

    def __init__(self, app, **cors_kwargs) -> None:
        self._app = app
        self._cors = CORSMiddleware(app, **cors_kwargs)

    async def __call__(self, scope, receive, send) -> None:
        if scope.get("type") == "http" and scope.get("path", "").startswith("/mcp"):
            await self._app(scope, receive, send)
        else:
            await self._cors(scope, receive, send)


_mcp = create_mcp_server() if settings.feature_mcp else None
_mcp_app = _mcp.http_app(path="/") if _mcp is not None else None
logger = logging.getLogger(__name__)


def _dispatch_push_notifications() -> None:
    db = None
    try:
        db = SessionLocal()
        for user_id in pending_push_user_ids(db):
            try:
                dispatch_overdue_chores(db, user_id)
                dispatch_medication_reminders(db, user_id)
                dispatch_missed_medications(db, user_id)
            except Exception:
                logger.exception("Push dispatch failed for user_id=%s", user_id)
    except Exception:
        logger.exception("Push dispatch loop iteration failed")
    finally:
        if db is not None:
            db.close()


async def _push_dispatch_loop() -> None:
    while True:
        await asyncio.to_thread(_dispatch_push_notifications)
        await asyncio.sleep(300)


def _user_local_date(user: User, now: datetime) -> date:
    try:
        tz = ZoneInfo(user.timezone)
    except ZoneInfoNotFoundError:
        tz = timezone.utc
    return now.astimezone(tz).date()


def _publish_today_rollovers(
    db,
    event_bus: EventBus,
    known_local_dates: dict[int, date],
    *,
    now: datetime | None = None,
) -> None:
    now = now or datetime.now(timezone.utc)
    subscribed_user_ids = event_bus.subscribed_user_ids()
    for user_id in list(known_local_dates):
        if user_id not in subscribed_user_ids:
            known_local_dates.pop(user_id, None)

    if not subscribed_user_ids:
        return

    users = db.query(User).where(User.id.in_(subscribed_user_ids)).where(User.is_active.is_(True)).all()
    for user in users:
        local_date = _user_local_date(user, now)
        previous_date = known_local_dates.get(user.id)
        known_local_dates[user.id] = local_date
        if previous_date is not None and previous_date != local_date:
            event_bus.publish(user.id, {"type": "today_updated"})


async def _today_rollover_loop(event_bus: EventBus) -> None:
    known_local_dates: dict[int, date] = {}
    while True:
        await asyncio.to_thread(_run_today_rollover_iteration, event_bus, known_local_dates)
        await asyncio.sleep(60)


def _run_today_rollover_iteration(event_bus: EventBus, known_local_dates: dict[int, date]) -> None:
    db = None
    try:
        db = SessionLocal()
        _publish_today_rollovers(db, event_bus, known_local_dates)
    except Exception:
        logger.exception("Today rollover event loop iteration failed")
    finally:
        if db is not None:
            db.close()


@asynccontextmanager
async def app_lifespan(app: Starlette):
    push_task: asyncio.Task | None = None
    rollover_task: asyncio.Task | None = None
    try:
        push_task = asyncio.create_task(_push_dispatch_loop())
        rollover_task = asyncio.create_task(_today_rollover_loop(get_event_bus()))
        yield
    finally:
        if push_task is not None:
            push_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await push_task
        if rollover_task is not None:
            rollover_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await rollover_task
        close_push_http_client()
        await close_auth_http_client()


lifespan = combine_lifespans(app_lifespan, _mcp_app.lifespan) if _mcp_app is not None else app_lifespan

app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)
app.middleware("http")(observability_middleware)

if settings.trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

if settings.cors_allow_origins:
    wildcard = "*" in settings.cors_allow_origins
    # Wrap CORSMiddleware so it skips /mcp — fastmcp handles CORS for its own
    # OAuth .well-known routes and a second CORS layer causes 404s on those paths.
    app.add_middleware(
        _MCPAwareCORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=not wildcard,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(system_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(users_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(households_router, prefix=f"{settings.api_prefix}/households")
app.include_router(integration_clients_router, prefix=settings.api_prefix)
app.include_router(home_assistant_router, prefix=settings.api_prefix)
app.include_router(today_router, prefix=settings.api_prefix)
app.include_router(medications_router, prefix=settings.api_prefix)
app.include_router(push_router, prefix=settings.api_prefix)
app.include_router(templates_router, prefix=f"{settings.api_prefix}/templates")
app.include_router(bulk_router, prefix=settings.api_prefix)
app.include_router(calendar_router, prefix=settings.api_prefix)
app.include_router(search_router, prefix=settings.api_prefix)
if _mcp_app is not None:
    app.mount("/mcp", _mcp_app)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "message": "API is running",
        "liveness": f"{settings.api_prefix}/health/liveness",
        "readiness": f"{settings.api_prefix}/health/readiness",
        "metrics": f"{settings.api_prefix}/metrics",
        "ha_summary": f"{settings.api_prefix}/integrations/home-assistant/summary",
        "mcp": "/mcp",
    }
