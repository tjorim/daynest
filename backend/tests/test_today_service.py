from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.config import AppSettings
from app.core.enums import ChoreStatus, MedicationDoseStatus, TaskStatus
from app.services.today_service import TodayService

_FIXED_NOW = datetime(2026, 4, 23, 10, 0, tzinfo=timezone.utc)


class StubTodayRepository:
    def __init__(self, tasks: list[SimpleNamespace], overdue: list[SimpleNamespace], due: list[SimpleNamespace], upcoming: list[SimpleNamespace], medication: list[SimpleNamespace], medication_history: list[SimpleNamespace], planned: list[SimpleNamespace], overdue_planned: list[SimpleNamespace] | None = None, dose: SimpleNamespace | None = None, timezone: str = "UTC", missed_doses: list[SimpleNamespace] | None = None):
        self._tasks = tasks
        self._overdue = overdue
        self._due = due
        self._upcoming = upcoming
        self._medication = medication
        self._medication_history = medication_history
        self._planned = planned
        self._overdue_planned = overdue_planned if overdue_planned is not None else []
        self._dose = dose
        self._timezone = timezone
        self._missed_doses = missed_doses if missed_doses is not None else []
        self.generated_through: date | None = None
        self.tasks_generated_through: date | None = None
        self.grace_minutes: int | None = None
        self.upcoming_horizon_days: int | None = None
        self.saved = False
        self.captured_user_timezone: str | None = None
        self._recurrence_series: list[SimpleNamespace] = []

    def ensure_chore_instances_generated(self, user_id: int, through_date: date) -> None:
        self.generated_through = through_date

    def get_user_timezone(self, user_id: int) -> str:
        return self._timezone

    def ensure_medication_dose_instances_generated(self, user_id: int, through_date: date, user_timezone: str = "UTC") -> None:
        self.captured_user_timezone = user_timezone

    def ensure_task_instances_generated(self, user_id: int, through_date: date) -> None:
        self.tasks_generated_through = through_date

    def mark_due_medications_missed(self, user_id: int, now, grace_minutes: int = 30):
        self.grace_minutes = grace_minutes
        return None

    def utcnow(self):
        return _FIXED_NOW

    def get_dose_for_user(self, user_id: int, dose_id: int) -> SimpleNamespace | None:
        return self._dose

    def save(self) -> None:
        self.saved = True

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
        self.upcoming_horizon_days = horizon_days
        return self._upcoming

    def get_day_chores(self, user_id: int, target_date: date) -> list[SimpleNamespace]:
        return self._due

    def list_planned_items(self, user_id: int, start_date: date | None = None, end_date: date | None = None, is_done: bool | None = None) -> list[SimpleNamespace]:
        if is_done is False and start_date is None and end_date is not None:
            return self._overdue_planned
        return self._planned

    def list_recurrence_series_overlapping(self, *, user_id: int, through_date: date) -> list[SimpleNamespace]:
        return self._recurrence_series

    def get_recurrence_series_for_user(self, *, user_id: int, recurrence_series_id):
        return next((series for series in self._recurrence_series if series.id == recurrence_series_id), None)

    def materialize_planned_items_for_series(self, *, series, through_date: date, materialized_dates: list[date]) -> None:
        return None

    def get_missed_doses_before(self, user_id: int, before_date: date) -> list[SimpleNamespace]:
        return [
            dose
            for dose in self._missed_doses
            if dose.status == MedicationDoseStatus.missed and dose.scheduled_date < before_date
        ]


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
            time_of_day=None,
            duration_minutes=None,
            notes=None,
            module_key="meal_planning",
            recurrence_hint="weekly",
            rrule=None,
            recurrence_series_id=None,
            linked_source=None,
            linked_ref=None,
            priority="normal",
            tags=[],
            is_done=False,
        )
    ]

    repo = StubTodayRepository(tasks=routine_tasks, overdue=overdue, due=due, upcoming=upcoming, medication=medication, medication_history=[], planned=planned)
    service = TodayService(
        repository=repo,
        app_settings=AppSettings(upcoming_horizon_days=3, medication_missed_grace_minutes=45),
    )

    response = service.get_today(user_id=7, for_date=for_date)

    assert repo.generated_through == date(2026, 4, 26)
    assert repo.tasks_generated_through == for_date
    assert repo.grace_minutes == 45
    assert repo.upcoming_horizon_days == 3

    assert response.medication[0].medication_dose_instance_id == 55
    assert response.routines[0].task_instance_id == 100
    assert response.overdue[0].chore_instance_id == 1
    assert response.due_today[0].chore_instance_id == 2
    assert response.upcoming[0].chore_instance_id == 3
    assert response.planned[0].id == 77
    assert response.planned[0].module_key == "meal_planning"
    assert len(response.day_items) == 4


def test_get_dashboard_read_model_includes_overdue_undone_planned_items() -> None:
    for_date = date(2026, 4, 23)
    today_planned = [
        SimpleNamespace(
            id=10,
            title="Today task",
            planned_for=for_date,
            time_of_day=None,
            duration_minutes=None,
            notes=None,
            module_key=None,
            recurrence_hint=None,
            rrule=None,
            recurrence_series_id=None,
            linked_source=None,
            linked_ref=None,
            priority="normal",
            tags=[],
            is_done=False,
        )
    ]
    overdue_planned = [
        SimpleNamespace(
            id=5,
            title="Overdue task",
            planned_for=date(2026, 4, 20),
            time_of_day=None,
            duration_minutes=None,
            notes="Still needed",
            module_key=None,
            recurrence_hint=None,
            rrule=None,
            recurrence_series_id=None,
            linked_source=None,
            linked_ref=None,
            priority="normal",
            tags=[],
            is_done=False,
        )
    ]
    repo = StubTodayRepository(
        tasks=[],
        overdue=[],
        due=[],
        upcoming=[],
        medication=[],
        medication_history=[],
        planned=today_planned,
        overdue_planned=overdue_planned,
    )
    service = TodayService(repository=repo, app_settings=AppSettings())

    model = service.get_dashboard_read_model(user_id=7, for_date=for_date)

    assert model.planned_count == 1
    assert model.planned_remaining_count == 1
    assert len(model.planned) == 2
    planned_ids = {item.id for item in model.planned}
    assert planned_ids == {5, 10}
    overdue_item = next(item for item in model.planned if item.id == 5)
    assert overdue_item.title == "Overdue task"
    assert overdue_item.planned_for == date(2026, 4, 20)


def test_get_dashboard_read_model_excludes_done_overdue_planned_items() -> None:
    for_date = date(2026, 4, 23)
    today_planned: list[SimpleNamespace] = []
    done_overdue_planned: list[SimpleNamespace] = []
    repo = StubTodayRepository(
        tasks=[],
        overdue=[],
        due=[],
        upcoming=[],
        medication=[],
        medication_history=[],
        planned=today_planned,
        overdue_planned=done_overdue_planned,
    )
    service = TodayService(repository=repo, app_settings=AppSettings())

    model = service.get_dashboard_read_model(user_id=7, for_date=for_date)

    assert model.planned_count == 0
    assert len(model.planned) == 0


def test_get_dashboard_due_today_includes_overdue_chores() -> None:
    for_date = date(2026, 4, 23)
    overdue_chore = SimpleNamespace(
        id=1, chore_template_id=11, title="Overdue chore", status=ChoreStatus.pending, scheduled_date=date(2026, 4, 20)
    )
    today_chore = SimpleNamespace(
        id=2, chore_template_id=12, title="Today chore", status=ChoreStatus.pending, scheduled_date=for_date
    )
    repo = StubTodayRepository(
        tasks=[], overdue=[overdue_chore], due=[today_chore], upcoming=[], medication=[], medication_history=[], planned=[]
    )
    service = TodayService(repository=repo, app_settings=AppSettings())

    model = service.get_dashboard_read_model(user_id=7, for_date=for_date)

    chore_ids = {item.chore_instance_id for item in model.due_today}
    assert 1 in chore_ids
    assert 2 in chore_ids


def test_get_dashboard_due_today_includes_completed_chores() -> None:
    for_date = date(2026, 4, 23)
    completed_chore = SimpleNamespace(
        id=3, chore_template_id=13, title="Done chore", status=ChoreStatus.completed, scheduled_date=for_date
    )
    repo = StubTodayRepository(
        tasks=[], overdue=[], due=[completed_chore], upcoming=[], medication=[], medication_history=[], planned=[]
    )
    service = TodayService(repository=repo, app_settings=AppSettings())

    model = service.get_dashboard_read_model(user_id=7, for_date=for_date)

    assert any(item.chore_instance_id == 3 for item in model.due_today)


def _make_service(dose: SimpleNamespace | None = None) -> tuple[StubTodayRepository, TodayService]:
    repo = StubTodayRepository(
        tasks=[],
        overdue=[],
        due=[],
        upcoming=[],
        medication=[],
        medication_history=[],
        planned=[],
        dose=dose,
    )
    service = TodayService(repository=repo, app_settings=AppSettings())
    return repo, service


def _make_dose(status: MedicationDoseStatus) -> SimpleNamespace:
    return SimpleNamespace(
        id=1,
        user_id=7,
        medication_plan_id=2,
        name="Vitamin D",
        instructions="Take with breakfast",
        scheduled_date=date(2026, 4, 23),
        scheduled_at=datetime(2026, 4, 23, 9, 0, tzinfo=timezone.utc),
        status=status,
        taken_at=None,
        skipped_at=None,
        missed_at=None,
    )


def test_mutate_medication_take_from_scheduled() -> None:
    dose = _make_dose(MedicationDoseStatus.scheduled)
    repo, service = _make_service(dose)

    result = service.mutate_medication_status(user_id=7, medication_dose_instance_id=1, action="take")

    assert result.status == MedicationDoseStatus.taken
    assert result.taken_at == _FIXED_NOW
    assert result.skipped_at is None
    assert result.missed_at is None
    assert repo.saved


def test_mutate_medication_take_from_missed() -> None:
    """A missed dose can be retroactively marked as taken."""
    dose = _make_dose(MedicationDoseStatus.missed)
    repo, service = _make_service(dose)

    result = service.mutate_medication_status(user_id=7, medication_dose_instance_id=1, action="take")

    assert result.status == MedicationDoseStatus.taken
    assert result.taken_at == _FIXED_NOW
    assert result.skipped_at is None
    assert result.missed_at is None
    assert repo.saved


def test_mutate_medication_take_rejects_future_taken_at() -> None:
    dose = _make_dose(MedicationDoseStatus.scheduled)
    repo, service = _make_service(dose)

    with pytest.raises(HTTPException) as exc_info:
        service.mutate_medication_status(
            user_id=7,
            medication_dose_instance_id=1,
            action="take",
            taken_at=_FIXED_NOW + timedelta(minutes=1),
        )

    assert exc_info.value.status_code == 422
    assert repo.saved is False


def test_mutate_medication_skip_from_missed() -> None:
    """A missed dose can be explicitly skipped."""
    dose = _make_dose(MedicationDoseStatus.missed)
    repo, service = _make_service(dose)

    result = service.mutate_medication_status(user_id=7, medication_dose_instance_id=1, action="skip")

    assert result.status == MedicationDoseStatus.skipped
    assert result.skipped_at == _FIXED_NOW
    assert result.taken_at is None
    assert result.missed_at is None
    assert repo.saved


def test_mutate_medication_take_from_taken_raises_conflict() -> None:
    """Attempting to take an already-taken dose raises 409."""
    dose = _make_dose(MedicationDoseStatus.taken)
    _, service = _make_service(dose)

    with pytest.raises(HTTPException) as exc_info:
        service.mutate_medication_status(user_id=7, medication_dose_instance_id=1, action="take")

    assert exc_info.value.status_code == 409


def test_mutate_medication_miss_from_missed_raises_conflict() -> None:
    """Attempting to mark a missed dose as missed again raises 409."""
    dose = _make_dose(MedicationDoseStatus.missed)
    _, service = _make_service(dose)

    with pytest.raises(HTTPException) as exc_info:
        service.mutate_medication_status(user_id=7, medication_dose_instance_id=1, action="miss")

    assert exc_info.value.status_code == 409


def test_mutate_medication_not_found_raises_404() -> None:
    """Missing dose raises 404."""
    repo, service = _make_service(dose=None)

    with pytest.raises(HTTPException) as exc_info:
        service.mutate_medication_status(user_id=7, medication_dose_instance_id=99, action="take")

    assert exc_info.value.status_code == 404


def test_get_today_threads_user_timezone_to_medication_generation() -> None:
    repo = StubTodayRepository(
        tasks=[], overdue=[], due=[], upcoming=[], medication=[], medication_history=[], planned=[],
        timezone="America/New_York",
    )
    service = TodayService(repository=repo, app_settings=AppSettings())
    service.get_today(user_id=7, for_date=date(2026, 4, 23))
    assert repo.captured_user_timezone == "America/New_York"


def test_skip_missed_medication_doses_default_cutoff_does_not_touch_today() -> None:
    fixed_today = _FIXED_NOW.date()
    missed_yesterday = _make_dose(MedicationDoseStatus.missed)
    missed_yesterday.scheduled_date = fixed_today - timedelta(days=1)
    missed_today = _make_dose(MedicationDoseStatus.missed)
    missed_today.scheduled_date = fixed_today
    repo = StubTodayRepository(
        tasks=[],
        overdue=[],
        due=[],
        upcoming=[],
        medication=[],
        medication_history=[],
        planned=[],
        missed_doses=[missed_yesterday, missed_today],
    )
    service = TodayService(repository=repo, app_settings=AppSettings())

    count, cutoff = service.skip_missed_medication_doses(user_id=7)

    assert cutoff == fixed_today
    assert count == 1
    assert missed_yesterday.status == MedicationDoseStatus.skipped
    assert missed_today.status == MedicationDoseStatus.missed
