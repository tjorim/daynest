from datetime import date, datetime, timezone
from types import SimpleNamespace

from app.models.task_instance import TaskStatus
from app.services.today_service import TodayService


class StubTodayRepository:
    def __init__(self, tasks: list[SimpleNamespace]):
        self._tasks = tasks

    def get_today_routines(self, user_id: int, for_date: date) -> list[SimpleNamespace]:
        return self._tasks

    def get_medication_placeholder(self) -> list[dict[str, str]]:
        return []

    def get_overdue_chores_placeholder(self) -> list[dict[str, str]]:
        return []


def test_get_today_shapes_routines_and_due_today_consistently() -> None:
    for_date = date(2026, 4, 23)
    due_at = datetime(2026, 4, 23, 9, 30, tzinfo=timezone.utc)
    tasks = [
        SimpleNamespace(
            id=100,
            routine_template_id=9,
            title="Morning walk",
            status=TaskStatus.pending,
            scheduled_date=for_date,
            due_at=due_at,
        )
    ]

    service = TodayService(repository=StubTodayRepository(tasks))

    response = service.get_today(user_id=7, for_date=for_date)

    assert response.medication == []
    assert response.overdue == []
    assert response.upcoming == []
    assert response.planned == []

    assert len(response.routines) == 1
    assert len(response.due_today) == 1

    routine_item = response.routines[0]
    due_today_item = response.due_today[0]

    assert routine_item.task_instance_id == tasks[0].id
    assert routine_item.routine_template_id == tasks[0].routine_template_id
    assert routine_item.title == tasks[0].title
    assert routine_item.status == TaskStatus.pending
    assert routine_item.scheduled_date == for_date
    assert routine_item.due_at == due_at

    assert due_today_item.task_instance_id == tasks[0].id
    assert due_today_item.title == tasks[0].title
    assert due_today_item.status == TaskStatus.pending
    assert due_today_item.scheduled_date == for_date
    assert due_today_item.due_at == due_at
