from fastapi import APIRouter, Depends

from app.services.today_service import TodayService

router = APIRouter(prefix="/integrations/home-assistant", tags=["integrations"])


@router.get("/summary")
def home_assistant_summary(service: TodayService = Depends(TodayService)) -> dict[str, str | int | None]:
    summary = service.get_summary()
    return {
        "todo_daynest_today": summary.tasks_remaining,
        "sensor_daynest_overdue_count": summary.overdue_count,
        "sensor_daynest_next_medication": summary.next_medication,
    }
