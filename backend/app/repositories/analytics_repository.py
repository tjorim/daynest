from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.enums import ChoreStatus, MedicationDoseStatus
from app.models.chore_instance import ChoreInstance
from app.models.chore_template import ChoreTemplate
from app.models.medication_dose_instance import MedicationDoseInstance
from app.models.planned_item import PlannedItem
from app.schemas.analytics import (
    ChoreStats,
    ChoreStreak,
    DailyAdherence,
    DailyCount,
    MedicationStats,
    PlannedItemStats,
    SkippedChore,
)


def _date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _rate(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


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

    # Full history needed for accurate streak calculation
    templates = {
        t.id: t.name
        for t in db.scalars(select(ChoreTemplate).where(ChoreTemplate.user_id == user_id)).all()
    }

    all_resolved = db.scalars(
        select(ChoreInstance)
        .where(ChoreInstance.user_id == user_id)
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
