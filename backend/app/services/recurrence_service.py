from datetime import date, datetime, time, timedelta

from dateutil.rrule import rrulestr


class RecurrenceValidationError(ValueError):
    pass


def generate_recurrence_dates(start_date: date, rrule: str, *, max_instances: int = 52) -> list[date]:
    try:
        start_dt = datetime.combine(start_date, time.min)
        rule = rrulestr(rrule, dtstart=start_dt, ignoretz=True)
    except Exception as exc:  # noqa: BLE001
        raise RecurrenceValidationError("Invalid recurrence rule") from exc

    dates: list[date] = []
    cursor = start_dt - timedelta(seconds=1)
    for _ in range(max_instances):
        occurrence = rule.after(cursor, inc=False)
        if occurrence is None:
            break
        dates.append(occurrence.date())
        cursor = occurrence

    if not dates:
        return [start_date]
    return dates
