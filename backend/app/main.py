from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as system_router
from app.api.routes.integrations.clients import router as integration_clients_router
from app.api.routes.integrations.home_assistant import router as home_assistant_router
from app.api.routes.integrations.mcp import router as mcp_router
from app.api.routes.medications import router as medications_router
from app.api.routes.today import router as today_router
from app.core.config import settings
from app.core.observability import configure_error_tracking, configure_logging, observability_middleware

configure_logging()
configure_error_tracking()

app = FastAPI(title=settings.app_name, version=settings.version)
app.middleware("http")(observability_middleware)

if settings.trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

if settings.cors_allow_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(system_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(integration_clients_router, prefix=settings.api_prefix)
app.include_router(home_assistant_router, prefix=settings.api_prefix)
app.include_router(mcp_router, prefix=settings.api_prefix)
app.include_router(today_router, prefix=settings.api_prefix)
app.include_router(medications_router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "message": "API is running",
        "liveness": f"{settings.api_prefix}/health/liveness",
        "readiness": f"{settings.api_prefix}/health/readiness",
        "metrics": f"{settings.api_prefix}/metrics",
        "ha_summary": f"{settings.api_prefix}/integrations/home-assistant/summary",
        "mcp_capabilities": f"{settings.api_prefix}/mcp/capabilities",
    }
