from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from dateutil.rrule import rrulestr


class RecurrenceValidationError(ValueError):
    pass


@dataclass(frozen=True)
class RecurrenceGeneration:
    dates: list[date]
    has_occurrence_after_horizon: bool


def generate_recurrence_dates(
    start_date: date,
    rrule: str,
    *,
    dtstart: date | None = None,
    through_date: date | None = None,
    max_horizon_days: int = 365,
    max_instances: int = 500,
) -> list[date]:
    return generate_recurrence(
        start_date,
        rrule,
        dtstart=dtstart,
        through_date=through_date,
        max_horizon_days=max_horizon_days,
        max_instances=max_instances,
    ).dates


def generate_recurrence(
    start_date: date,
    rrule: str,
    *,
    dtstart: date | None = None,
    through_date: date | None = None,
    max_horizon_days: int = 365,
    max_instances: int = 500,
) -> RecurrenceGeneration:
    try:
        start_dt = datetime.combine(dtstart or start_date, time.min)
        rule = rrulestr(rrule, dtstart=start_dt, ignoretz=True)
    except ValueError as exc:
        raise RecurrenceValidationError("Invalid recurrence rule") from exc

    horizon = (through_date + timedelta(days=1)) if through_date is not None else (start_date + timedelta(days=max_horizon_days))

    dates: list[date] = []
    cursor = datetime.combine(start_date, time.min)
    for i in range(max_instances):
        occurrence = rule.after(cursor, inc=(i == 0))
        if occurrence is None:
            return RecurrenceGeneration(dates=dates, has_occurrence_after_horizon=False)
        if occurrence.date() >= horizon:
            return RecurrenceGeneration(dates=dates, has_occurrence_after_horizon=True)
        dates.append(occurrence.date())
        cursor = occurrence

    return RecurrenceGeneration(dates=dates, has_occurrence_after_horizon=True)
