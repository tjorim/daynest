from datetime import date, datetime, timezone
from types import SimpleNamespace

from app.models.chore_instance import ChoreStatus
from app.models.medication_dose_instance import MedicationDoseStatus
from app.models.task_instance import TaskStatus
from app.services.today_service import TodayService


class StubTodayRepository:
    def __init__(self, tasks: list[SimpleNamespace], overdue: list[SimpleNamespace], due: list[SimpleNamespace], upcoming: list[SimpleNamespace], medication: list[SimpleNamespace], medication_history: list[SimpleNamespace], planned: list[SimpleNamespace]):
        self._tasks = tasks
        self._overdue = overdue
        self._due = due
        self._upcoming = upcoming
        self._medication = medication
        self._medication_history = medication_history
        self._planned = planned
        self.generated_through: date | None = None

    def ensure_chore_instances_generated(self, user_id: int, through_date: date) -> None:
        self.generated_through = through_date

    def ensure_medication_dose_instances_generated(self, user_id: int, through_date: date) -> None:
        return None

    def mark_due_medications_missed(self, user_id: int, now, grace_minutes: int = 30):
        return None

    def utcnow(self):
        from datetime import datetime, timezone

        return datetime.now(timezone.utc)

    def get_today_medication(self, user_id: int, for_date: date) -> list[SimpleNamespace]:
        return self._medication

    def get_medication_history(self, user_id: int, before_date: date, limit: int = 20) -> list[SimpleNamespace]:
        return self._medication_history

    def get_today_routines(self, user_id: int, for_date: date) -> list[SimpleNamespace]:
        return self._tasks

    def get_overdue_chores(self, user_id: int, for_date: date) -> list[SimpleNamespace]:
        return self._overdue

    def get_due_today_chores(self, user_id: int, for_date: date) -> list[SimpleNamespace]:
        return self._due

    def get_upcoming_chores(self, user_id: int, for_date: date, horizon_days: int = 7) -> list[SimpleNamespace]:
        return self._upcoming

    def get_day_chores(self, user_id: int, target_date: date) -> list[SimpleNamespace]:
        return self._due

    def list_planned_items(self, user_id: int, start_date: date | None = None, end_date: date | None = None) -> list[SimpleNamespace]:
        return self._planned


def test_get_today_shapes_chore_sections() -> None:
    for_date = date(2026, 4, 23)
    routine_tasks = [
        SimpleNamespace(
            id=100,
            routine_template_id=9,
            title="Morning walk",
            status=TaskStatus.pending,
            scheduled_date=for_date,
            due_at=None,
        )
    ]
    medication = [
        SimpleNamespace(
            id=55,
            medication_plan_id=8,
            name="Vitamin D",
            instructions="Take with breakfast",
            scheduled_at=datetime(2026, 4, 23, 9, 0, tzinfo=timezone.utc),
            scheduled_date=for_date,
            status=MedicationDoseStatus.scheduled,
        )
    ]
    overdue = [SimpleNamespace(id=1, chore_template_id=11, title="Laundry", status=ChoreStatus.pending, scheduled_date=date(2026, 4, 20))]
    due = [SimpleNamespace(id=2, chore_template_id=12, title="Trash", status=ChoreStatus.pending, scheduled_date=for_date)]
    upcoming = [SimpleNamespace(id=3, chore_template_id=13, title="Vacuum", scheduled_date=date(2026, 4, 24))]
    planned = [
        SimpleNamespace(
            id=77,
            title="Meal prep",
            planned_for=for_date,
            notes=None,
            module_key="meal_planning",
            recurrence_hint="weekly",
            linked_source=None,
            linked_ref=None,
            is_done=False,
        )
    ]

    repo = StubTodayRepository(tasks=routine_tasks, overdue=overdue, due=due, upcoming=upcoming, medication=medication, medication_history=[], planned=planned)
    service = TodayService(repository=repo)

    response = service.get_today(user_id=7, for_date=for_date)

    assert repo.generated_through == date(2026, 4, 30)

    assert response.medication[0].medication_dose_instance_id == 55
    assert response.routines[0].task_instance_id == 100
    assert response.overdue[0].chore_instance_id == 1
    assert response.due_today[0].chore_instance_id == 2
    assert response.upcoming[0].chore_instance_id == 3
    assert response.planned[0].id == 77
    assert response.planned[0].module_key == "meal_planning"
    assert len(response.day_items) == 4
