from app.schemas.integrations import TodaySummary


class TodayService:
    """Read model service for today's dashboard and integrations.

    This is intentionally simple in the scaffold. The same service should back:
    - REST today endpoints
    - Home Assistant helper endpoints
    - MCP adapter tools
    """

    def get_summary(self) -> TodaySummary:
        # Placeholder values until persistence and generation jobs are implemented.
        return TodaySummary(
            overdue_count=0,
            tasks_remaining=0,
            next_medication=None,
        )
