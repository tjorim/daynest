from datetime import date, datetime, time, timedelta

from dateutil.rrule import rrulestr


class RecurrenceValidationError(ValueError):
    pass


def generate_recurrence_dates(
    start_date: date,
    rrule: str,
    *,
    dtstart: date | None = None,
    through_date: date | None = None,
    max_horizon_days: int = 365,
    max_instances: int = 500,
) -> list[date]:
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
            break
        if occurrence.date() >= horizon:
            break
        dates.append(occurrence.date())
        cursor = occurrence

    if not dates and through_date is not None:
        return []
    if not dates:
        return [start_date]
    return dates


def recurrence_has_occurrence_after(
    after_date: date,
    rrule: str,
    *,
    dtstart: date | None = None,
) -> bool:
    try:
        start_dt = datetime.combine(dtstart or after_date, time.min)
        rule = rrulestr(rrule, dtstart=start_dt, ignoretz=True)
    except ValueError as exc:
        raise RecurrenceValidationError("Invalid recurrence rule") from exc

    return rule.after(datetime.combine(after_date, time.min), inc=False) is not None
