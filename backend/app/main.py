import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes.auth import close_http_client as close_auth_http_client
from app.api.routes.auth import router as auth_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.bulk import router as bulk_router
from app.api.routes.calendar import router as calendar_router
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
from app.services.push_service import dispatch_medication_reminders, dispatch_missed_medications, dispatch_overdue_chores

configure_logging()
configure_error_tracking()

_mcp = create_mcp_server() if settings.feature_mcp else None
logger = logging.getLogger(__name__)


async def _push_dispatch_loop() -> None:
    while True:
        db = None
        try:
            db = SessionLocal()
            users = db.query(User.id).where(User.is_active.is_(True)).all()
            for user_id, in users:
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
        db = None
        try:
            db = SessionLocal()
            _publish_today_rollovers(db, event_bus, known_local_dates)
        except Exception:
            logger.exception("Today rollover event loop iteration failed")
        finally:
            if db is not None:
                db.close()
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    push_task: asyncio.Task | None = None
    rollover_task: asyncio.Task | None = None
    try:
        push_task = asyncio.create_task(_push_dispatch_loop())
        rollover_task = asyncio.create_task(_today_rollover_loop(get_event_bus()))
        if _mcp is not None:
            async with _mcp.session_manager.run():
                yield
        else:
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
        await close_auth_http_client()


app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)
app.middleware("http")(observability_middleware)

if settings.trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

if settings.cors_allow_origins:
    wildcard = "*" in settings.cors_allow_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=not wildcard,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(system_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(users_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(integration_clients_router, prefix=settings.api_prefix)
app.include_router(home_assistant_router, prefix=settings.api_prefix)
app.include_router(today_router, prefix=settings.api_prefix)
app.include_router(medications_router, prefix=settings.api_prefix)
app.include_router(push_router, prefix=settings.api_prefix)
app.include_router(templates_router, prefix=f"{settings.api_prefix}/templates")
app.include_router(bulk_router, prefix=settings.api_prefix)
app.include_router(calendar_router, prefix=settings.api_prefix)
app.include_router(search_router, prefix=settings.api_prefix)
if _mcp is not None:
    app.mount("/mcp", _mcp.streamable_http_app())


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
