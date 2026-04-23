from pydantic import BaseModel


class TodaySummary(BaseModel):
    overdue_count: int
    tasks_remaining: int
    next_medication: str | None = None


class IntegrationCapabilities(BaseModel):
    home_assistant: bool
    mcp_adapter: bool
    export_import: bool
