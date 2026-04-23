from fastapi import FastAPI

from app.api.routes.health import router as system_router
from app.api.routes.integrations.home_assistant import router as home_assistant_router
from app.api.routes.integrations.mcp import router as mcp_router
from app.api.routes.today import router as today_router
from app.core.config import settings

app = FastAPI(title=settings.app_name, version=settings.version)

app.include_router(system_router, prefix=settings.api_prefix)
app.include_router(home_assistant_router, prefix=settings.api_prefix)
app.include_router(mcp_router, prefix=settings.api_prefix)
app.include_router(today_router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "message": "API is running",
        "health": f"{settings.api_prefix}/health",
        "ha_summary": f"{settings.api_prefix}/integrations/home-assistant/summary",
        "mcp_capabilities": f"{settings.api_prefix}/mcp/capabilities",
    }
