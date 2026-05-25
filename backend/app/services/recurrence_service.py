from datetime import date, datetime, time, timedelta

from dateutil.rrule import rrulestr


class RecurrenceValidationError(ValueError):
    pass


def generate_recurrence_dates(
    start_date: date,
    rrule: str,
    *,
    max_horizon_days: int = 365,
    max_instances: int = 500,
) -> list[date]:
    try:
        start_dt = datetime.combine(start_date, time.min)
        rule = rrulestr(rrule, dtstart=start_dt, ignoretz=True)
    except ValueError as exc:
        raise RecurrenceValidationError("Invalid recurrence rule") from exc

    horizon = start_date + timedelta(days=max_horizon_days)

    dates: list[date] = []
    # Start just before dtstart so the first `after(..., inc=False)` call can include dtstart occurrences.
    cursor = start_dt - timedelta(seconds=1)
    for _ in range(max_instances):
        occurrence = rule.after(cursor, inc=False)
        if occurrence is None:
            break
        if occurrence.date() >= horizon:
            break
        dates.append(occurrence.date())
        cursor = occurrence

    if not dates:
        return [start_date]
    return dates
