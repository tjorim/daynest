from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
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
    period_instances = db.scalars(
        select(ChoreInstance)
        .where(ChoreInstance.user_id == user_id)
        .where(ChoreInstance.scheduled_date >= start_date)
        .where(ChoreInstance.scheduled_date <= end_date)
    ).all()

    by_date: dict[date, list[ChoreInstance]] = defaultdict(list)
    for inst in period_instances:
        by_date[inst.scheduled_date].append(inst)

    dates = _date_range(start_date, end_date)
    daily_completions = []
    for d in dates:
        completed = sum(1 for i in by_date[d] if i.status == ChoreStatus.completed)
        total = len(by_date[d])
        daily_completions.append(DailyCount(date=d, completed=completed, total=total, completion_rate=_rate(completed, total)))

    total_completed = sum(1 for i in period_instances if i.status == ChoreStatus.completed)
    total_scheduled = len(period_instances)
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
    most_skipped: list[SkippedChore] = []

    for template_id, insts in by_template.items():
        name = templates.get(template_id, f"Chore #{template_id}")
        sorted_insts = sorted(insts, key=lambda i: i.scheduled_date)

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

        skip_count = sum(
            1 for i in insts
            if i.status == ChoreStatus.skipped and start_date <= i.scheduled_date <= end_date
        )
        if skip_count > 0:
            most_skipped.append(SkippedChore(chore_id=template_id, name=name, skip_count=skip_count))

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
    instances = db.scalars(
        select(MedicationDoseInstance)
        .where(MedicationDoseInstance.user_id == user_id)
        .where(MedicationDoseInstance.scheduled_date >= start_date)
        .where(MedicationDoseInstance.scheduled_date <= end_date)
    ).all()

    by_date: dict[date, list[MedicationDoseInstance]] = defaultdict(list)
    for inst in instances:
        by_date[inst.scheduled_date].append(inst)

    dates = _date_range(start_date, end_date)
    daily_adherence = []
    for d in dates:
        taken = sum(1 for i in by_date[d] if i.status == MedicationDoseStatus.taken)
        total = len(by_date[d])
        daily_adherence.append(DailyAdherence(date=d, taken=taken, total=total, adherence_rate=_rate(taken, total)))

    total_taken = sum(1 for i in instances if i.status == MedicationDoseStatus.taken)
    total_scheduled = len(instances)
    adherence_rate = _rate(total_taken, total_scheduled)

    return MedicationStats(
        adherence_rate=round(adherence_rate, 4),
        total_taken=total_taken,
        total_scheduled=total_scheduled,
        daily_adherence=daily_adherence,
    )


def get_planned_item_stats(db: Session, user_id: int, start_date: date, end_date: date) -> PlannedItemStats:
    items = db.scalars(
        select(PlannedItem)
        .where(PlannedItem.user_id == user_id)
        .where(PlannedItem.planned_for >= start_date)
        .where(PlannedItem.planned_for <= end_date)
    ).all()

    by_date: dict[date, list[PlannedItem]] = defaultdict(list)
    for item in items:
        by_date[item.planned_for].append(item)

    dates = _date_range(start_date, end_date)
    daily_completions = []
    for d in dates:
        completed = sum(1 for i in by_date[d] if i.is_done)
        total = len(by_date[d])
        daily_completions.append(DailyCount(date=d, completed=completed, total=total, completion_rate=_rate(completed, total)))

    total_completed = sum(1 for i in items if i.is_done)
    total_scheduled = len(items)
    completion_rate = _rate(total_completed, total_scheduled)

    return PlannedItemStats(
        completion_rate=round(completion_rate, 4),
        total_completed=total_completed,
        total_scheduled=total_scheduled,
        daily_completions=daily_completions,
    )
