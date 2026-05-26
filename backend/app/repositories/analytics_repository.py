from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import ChoreStatus, MedicationDoseStatus, TaskStatus
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.planned_item import PlannedItem
from app.models.routine_template import RoutineTemplate
from app.models.task_instance import TaskInstance
from app.schemas.analytics import (
    ChoreStats,
    ChoreStreak,
    DailyAdherence,
    DailyCount,
    MedicationStats,
    PlannedItemStats,
    SchedulingSuggestion,
    RoutineStats,
    RoutineStreak,
    SkippedChore,
)

_MIN_STREAK_LOOKBACK_DAYS = 90
_SUGGESTION_LOOKBACK_DAYS = 56
_OVERLOAD_THRESHOLD = 8
_OVERLOAD_MOVE_COUNT = 3
_WEEKDAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


@dataclass
class _MedicationSuggestionStats:
    name: str = ""
    total: int = 0
    not_taken: int = 0
    taken: int = 0
    time_label: str = ""


def _date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _rate(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def _streak_lookback_start(start_date: date, end_date: date) -> date:
    period_days = (end_date - start_date).days + 1
    lookback_days = max(period_days, _MIN_STREAK_LOOKBACK_DAYS)
    return end_date - timedelta(days=lookback_days - 1)


def get_chore_stats(db: Session, user_id: int, start_date: date, end_date: date) -> ChoreStats:
    daily_rows = db.execute(
        select(
            ChoreInstance.scheduled_date,
            func.count(ChoreInstance.id),
            func.sum(case((ChoreInstance.status == ChoreStatus.completed, 1), else_=0)),
        )
        .where(ChoreInstance.user_id == user_id)
        .where(ChoreInstance.scheduled_date >= start_date)
        .where(ChoreInstance.scheduled_date <= end_date)
        .group_by(ChoreInstance.scheduled_date)
    ).all()

    by_date = {row[0]: {"total": int(row[1]), "completed": int(row[2] or 0)} for row in daily_rows}

    dates = _date_range(start_date, end_date)
    daily_completions = []
    for d in dates:
        total = by_date.get(d, {}).get("total", 0)
        completed = by_date.get(d, {}).get("completed", 0)
        daily_completions.append(DailyCount(date=d, completed=completed, total=total, completion_rate=_rate(completed, total)))

    total_completed = sum(day["completed"] for day in by_date.values())
    total_scheduled = sum(day["total"] for day in by_date.values())
    completion_rate = _rate(total_completed, total_scheduled)

    streak_start_date = _streak_lookback_start(start_date, end_date)
    templates = {
        t.id: t.name
        for t in db.scalars(select(ChoreTemplate).where(ChoreTemplate.user_id == user_id)).all()
    }

    all_resolved = db.scalars(
        select(ChoreInstance)
        .where(ChoreInstance.user_id == user_id)
        .where(ChoreInstance.scheduled_date >= streak_start_date)
        .where(ChoreInstance.scheduled_date <= end_date)
        .where(ChoreInstance.status != ChoreStatus.pending)
        .order_by(ChoreInstance.chore_template_id, ChoreInstance.scheduled_date)
    ).all()

    by_template: dict[int, list[ChoreInstance]] = defaultdict(list)
    for inst in all_resolved:
        by_template[inst.chore_template_id].append(inst)

    streaks: list[ChoreStreak] = []

    for template_id, insts in by_template.items():
        name = templates.get(template_id, f"Chore #{template_id}")
        sorted_insts = insts

        current = 0
        for inst in reversed(sorted_insts):
            if inst.status == ChoreStatus.completed:
                current += 1
            else:
                break

        longest, run = 0, 0
        for inst in sorted_insts:
            if inst.status == ChoreStatus.completed:
                run += 1
                longest = max(longest, run)
            else:
                run = 0

        streaks.append(ChoreStreak(
            chore_id=template_id,
            name=name,
            current_streak=current,
            longest_streak=longest,
        ))

    skipped_rows = db.execute(
        select(ChoreInstance.chore_template_id, func.count(ChoreInstance.id))
        .where(ChoreInstance.user_id == user_id)
        .where(ChoreInstance.scheduled_date >= start_date)
        .where(ChoreInstance.scheduled_date <= end_date)
        .where(ChoreInstance.status == ChoreStatus.skipped)
        .group_by(ChoreInstance.chore_template_id)
    ).all()
    most_skipped = [
        SkippedChore(
            chore_id=row[0],
            name=templates.get(row[0], f"Chore #{row[0]}"),
            skip_count=int(row[1]),
        )
        for row in skipped_rows
    ]

    streaks.sort(key=lambda x: x.current_streak, reverse=True)
    most_skipped.sort(key=lambda x: x.skip_count, reverse=True)

    return ChoreStats(
        completion_rate=round(completion_rate, 4),
        total_completed=total_completed,
        total_scheduled=total_scheduled,
        daily_completions=daily_completions,
        streaks=streaks,
        most_skipped=most_skipped,
    )


def get_medication_stats(db: Session, user_id: int, start_date: date, end_date: date) -> MedicationStats:
    daily_rows = db.execute(
        select(
            MedicationDoseInstance.scheduled_date,
            func.count(MedicationDoseInstance.id),
            func.sum(case((MedicationDoseInstance.status == MedicationDoseStatus.taken, 1), else_=0)),
        )
        .where(MedicationDoseInstance.user_id == user_id)
        .where(MedicationDoseInstance.scheduled_date >= start_date)
        .where(MedicationDoseInstance.scheduled_date <= end_date)
        .group_by(MedicationDoseInstance.scheduled_date)
    ).all()

    by_date = {row[0]: {"total": int(row[1]), "taken": int(row[2] or 0)} for row in daily_rows}

    dates = _date_range(start_date, end_date)
    daily_adherence = []
    for d in dates:
        total = by_date.get(d, {}).get("total", 0)
        taken = by_date.get(d, {}).get("taken", 0)
        daily_adherence.append(DailyAdherence(date=d, taken=taken, total=total, adherence_rate=_rate(taken, total)))

    total_taken = sum(day["taken"] for day in by_date.values())
    total_scheduled = sum(day["total"] for day in by_date.values())
    adherence_rate = _rate(total_taken, total_scheduled)

    return MedicationStats(
        adherence_rate=round(adherence_rate, 4),
        total_taken=total_taken,
        total_scheduled=total_scheduled,
        daily_adherence=daily_adherence,
    )


def get_planned_item_stats(db: Session, user_id: int, start_date: date, end_date: date) -> PlannedItemStats:
    daily_rows = db.execute(
        select(
            PlannedItem.planned_for,
            func.count(PlannedItem.id),
            func.sum(case((PlannedItem.is_done.is_(True), 1), else_=0)),
        )
        .where(PlannedItem.user_id == user_id)
        .where(PlannedItem.planned_for >= start_date)
        .where(PlannedItem.planned_for <= end_date)
        .group_by(PlannedItem.planned_for)
    ).all()

    by_date = {row[0]: {"total": int(row[1]), "completed": int(row[2] or 0)} for row in daily_rows}

    dates = _date_range(start_date, end_date)
    daily_completions = []
    for d in dates:
        total = by_date.get(d, {}).get("total", 0)
        completed = by_date.get(d, {}).get("completed", 0)
        daily_completions.append(DailyCount(date=d, completed=completed, total=total, completion_rate=_rate(completed, total)))

    total_completed = sum(day["completed"] for day in by_date.values())
    total_scheduled = sum(day["total"] for day in by_date.values())
    completion_rate = _rate(total_completed, total_scheduled)

    return PlannedItemStats(
        completion_rate=round(completion_rate, 4),
        total_completed=total_completed,
        total_scheduled=total_scheduled,
        daily_completions=daily_completions,
    )


def get_routine_stats(db: Session, user_id: int, start_date: date, end_date: date) -> RoutineStats:
    daily_rows = db.execute(
        select(
            TaskInstance.scheduled_date,
            func.count(TaskInstance.id),
            func.sum(case((TaskInstance.status == TaskStatus.completed, 1), else_=0)),
        )
        .where(TaskInstance.user_id == user_id)
        .where(TaskInstance.scheduled_date >= start_date)
        .where(TaskInstance.scheduled_date <= end_date)
        .group_by(TaskInstance.scheduled_date)
    ).all()

    by_date = {row[0]: {"total": int(row[1]), "completed": int(row[2] or 0)} for row in daily_rows}

    dates = _date_range(start_date, end_date)
    daily_completions = []
    for d in dates:
        total = by_date.get(d, {}).get("total", 0)
        completed = by_date.get(d, {}).get("completed", 0)
        daily_completions.append(DailyCount(date=d, completed=completed, total=total, completion_rate=_rate(completed, total)))

    total_completed = sum(day["completed"] for day in by_date.values())
    total_scheduled = sum(day["total"] for day in by_date.values())
    completion_rate = _rate(total_completed, total_scheduled)

    streak_start_date = _streak_lookback_start(start_date, end_date)
    templates = {
        t.id: t.name
        for t in db.scalars(select(RoutineTemplate).where(RoutineTemplate.user_id == user_id)).all()
    }

    all_resolved = db.scalars(
        select(TaskInstance)
        .where(TaskInstance.user_id == user_id)
        .where(TaskInstance.scheduled_date >= streak_start_date)
        .where(TaskInstance.scheduled_date <= end_date)
        .where(TaskInstance.status.notin_([TaskStatus.pending, TaskStatus.in_progress]))
        .order_by(TaskInstance.routine_template_id, TaskInstance.scheduled_date)
    ).all()

    by_template: dict[int, list[TaskInstance]] = defaultdict(list)
    for inst in all_resolved:
        by_template[inst.routine_template_id].append(inst)

    streaks: list[RoutineStreak] = []
    for template_id, insts in by_template.items():
        name = templates.get(template_id, f"Routine #{template_id}")

        current = 0
        for inst in reversed(insts):
            if inst.status == TaskStatus.completed:
                current += 1
            else:
                break

        longest, run = 0, 0
        for inst in insts:
            if inst.status == TaskStatus.completed:
                run += 1
                longest = max(longest, run)
            else:
                run = 0

        streaks.append(RoutineStreak(
            routine_id=template_id,
            name=name,
            current_streak=current,
            longest_streak=longest,
        ))

    streaks.sort(key=lambda x: x.current_streak, reverse=True)

    return RoutineStats(
        completion_rate=round(completion_rate, 4),
        total_completed=total_completed,
        total_scheduled=total_scheduled,
        daily_completions=daily_completions,
        streaks=streaks,
    )


def _weekday_name(value: int) -> str:
    return _WEEKDAY_NAMES[value % 7]


def _shift_time_label(base_time: datetime, *, minutes: int) -> str:
    shifted = base_time + timedelta(minutes=minutes)
    return shifted.strftime("%H:%M")


def get_scheduling_suggestions(db: Session, user_id: int, for_date: date) -> list[SchedulingSuggestion]:
    suggestions: list[SchedulingSuggestion] = []
    lookback_start = for_date - timedelta(days=_SUGGESTION_LOOKBACK_DAYS - 1)

    chore_templates = {
        template.id: template.name
        for template in db.scalars(select(ChoreTemplate).where(ChoreTemplate.user_id == user_id)).all()
    }
    chore_rows = db.scalars(
        select(ChoreInstance)
        .where(ChoreInstance.user_id == user_id)
        .where(ChoreInstance.scheduled_date >= lookback_start)
        .where(ChoreInstance.scheduled_date <= for_date)
        .where(ChoreInstance.status.in_([ChoreStatus.completed, ChoreStatus.skipped]))
    ).all()
    chore_weekday_counts: dict[tuple[int, int], dict[str, int]] = defaultdict(lambda: {"skipped": 0, "completed": 0})
    for chore in chore_rows:
        key = (chore.chore_template_id, chore.scheduled_date.weekday())
        if chore.status == ChoreStatus.skipped:
            chore_weekday_counts[key]["skipped"] += 1
        elif chore.status == ChoreStatus.completed:
            chore_weekday_counts[key]["completed"] += 1

    best_chore: tuple[int, int, int, int] | None = None
    for (template_id, weekday), counts in chore_weekday_counts.items():
        skipped = counts["skipped"]
        completed = counts["completed"]
        if skipped >= 2 and skipped > completed:
            candidate = (skipped, -completed, template_id, weekday)
            if best_chore is None or candidate > best_chore:
                best_chore = candidate

    if best_chore is not None:
        skipped, neg_completed, template_id, weekday = best_chore
        completed = -neg_completed
        suggested_weekday = (weekday + 1) % 7
        chore_name = chore_templates.get(template_id, f"Chore #{template_id}")
        suggestions.append(
            SchedulingSuggestion(
                suggestion_type="chore_reschedule",
                message=(
                    f"You often skip {chore_name} on {_weekday_name(weekday)}s — "
                    f"consider rescheduling to {_weekday_name(suggested_weekday)}."
                ),
                metadata={
                    "chore_template_id": template_id,
                    "weekday": _weekday_name(weekday),
                    "suggested_weekday": _weekday_name(suggested_weekday),
                    "skip_count": skipped,
                    "completed_count": completed,
                },
            )
        )

    medication_rows = db.scalars(
        select(MedicationDoseInstance)
        .options(joinedload(MedicationDoseInstance.medication_plan))
        .where(MedicationDoseInstance.user_id == user_id)
        .where(MedicationDoseInstance.scheduled_date >= lookback_start)
        .where(MedicationDoseInstance.scheduled_date <= for_date)
    ).all()
    medication_counts: dict[int, _MedicationSuggestionStats] = defaultdict(_MedicationSuggestionStats)
    for dose in medication_rows:
        item = medication_counts[dose.medication_plan_id]
        item.name = dose.name
        item.time_label = dose.medication_plan.schedule_time.strftime("%H:%M")
        item.total += 1
        if dose.status == MedicationDoseStatus.taken:
            item.taken += 1
        elif dose.status in (MedicationDoseStatus.skipped, MedicationDoseStatus.missed):
            item.not_taken += 1

    weakest_medication: tuple[float, int] | None = None
    for medication_plan_id, stats in medication_counts.items():
        total = stats.total
        not_taken = stats.not_taken
        if total < 4 or not_taken < 2:
            continue
        adherence = (total - not_taken) / total
        if adherence >= 0.7:
            continue
        candidate = (adherence, medication_plan_id)
        if weakest_medication is None or candidate < weakest_medication:
            weakest_medication = candidate

    if weakest_medication is not None:
        _, medication_plan_id = weakest_medication
        stats = medication_counts[medication_plan_id]
        current_time = stats.time_label or "09:00"
        base_time = datetime.strptime(current_time, "%H:%M")
        suggested_time = _shift_time_label(base_time, minutes=-30)
        suggestions.append(
            SchedulingSuggestion(
                suggestion_type="medication_reminder_adjustment",
                message=(
                    f"{stats.name} is frequently missed at {current_time} — "
                    f"consider a reminder around {suggested_time}."
                ),
                metadata={
                    "medication_plan_id": medication_plan_id,
                    "current_time": current_time,
                    "suggested_time": suggested_time,
                    "total_doses": stats.total,
                    "not_taken_count": stats.not_taken,
                },
            )
        )

    window_end = for_date + timedelta(days=6)
    day_totals: dict[date, int] = {for_date + timedelta(days=i): 0 for i in range(7)}
    for scheduled_date, count in db.execute(
        select(ChoreInstance.scheduled_date, func.count(ChoreInstance.id))
        .where(ChoreInstance.user_id == user_id)
        .where(ChoreInstance.scheduled_date >= for_date)
        .where(ChoreInstance.scheduled_date <= window_end)
        .where(ChoreInstance.status == ChoreStatus.pending)
        .group_by(ChoreInstance.scheduled_date)
    ).all():
        day_totals[scheduled_date] += int(count)
    for scheduled_date, count in db.execute(
        select(TaskInstance.scheduled_date, func.count(TaskInstance.id))
        .where(TaskInstance.user_id == user_id)
        .where(TaskInstance.scheduled_date >= for_date)
        .where(TaskInstance.scheduled_date <= window_end)
        .where(TaskInstance.status.in_([TaskStatus.pending, TaskStatus.in_progress]))
        .group_by(TaskInstance.scheduled_date)
    ).all():
        day_totals[scheduled_date] += int(count)
    for scheduled_date, count in db.execute(
        select(MedicationDoseInstance.scheduled_date, func.count(MedicationDoseInstance.id))
        .where(MedicationDoseInstance.user_id == user_id)
        .where(MedicationDoseInstance.scheduled_date >= for_date)
        .where(MedicationDoseInstance.scheduled_date <= window_end)
        .where(MedicationDoseInstance.status == MedicationDoseStatus.scheduled)
        .group_by(MedicationDoseInstance.scheduled_date)
    ).all():
        day_totals[scheduled_date] += int(count)
    for planned_for, count in db.execute(
        select(PlannedItem.planned_for, func.count(PlannedItem.id))
        .where(PlannedItem.user_id == user_id)
        .where(PlannedItem.planned_for >= for_date)
        .where(PlannedItem.planned_for <= window_end)
        .where(PlannedItem.is_done.is_(False))
        .group_by(PlannedItem.planned_for)
    ).all():
        day_totals[planned_for] += int(count)

    if day_totals:
        overloaded_day, overloaded_count = max(day_totals.items(), key=lambda item: item[1])
        candidate_days = [
            (day, count)
            for day, count in day_totals.items()
            if day != overloaded_day and count <= overloaded_count - 3
        ]
        if overloaded_count >= _OVERLOAD_THRESHOLD and candidate_days:
            target_day, target_count = min(candidate_days, key=lambda item: item[1])
            move_count = min(_OVERLOAD_MOVE_COUNT, (overloaded_count - target_count) // 2)
            if move_count > 0:
                suggestions.append(
                    SchedulingSuggestion(
                        suggestion_type="load_balancing",
                        message=(
                            f"{_weekday_name(overloaded_day.weekday())} has {overloaded_count} items — "
                            f"move {move_count} to {_weekday_name(target_day.weekday())}?"
                        ),
                        metadata={
                            "overloaded_date": overloaded_day.isoformat(),
                            "overloaded_count": overloaded_count,
                            "target_date": target_day.isoformat(),
                            "target_count": target_count,
                            "move_count": move_count,
                        },
                    )
                )

    return suggestions
