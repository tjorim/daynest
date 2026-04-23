from fastapi import APIRouter

from app.schemas.integrations import IntegrationCapabilities

router = APIRouter(prefix="/mcp", tags=["integrations"])


@router.get("/capabilities")
def mcp_capabilities() -> IntegrationCapabilities:
    return IntegrationCapabilities(
        home_assistant=True,
        mcp_adapter=True,
        export_import=False,
    )
