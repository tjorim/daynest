"""Unit tests for generate_recurrence_dates (time-horizon cap)."""

from datetime import date, timedelta

import pytest

from app.services.recurrence_service import (
    RecurrenceValidationError,
    generate_recurrence,
    generate_recurrence_dates,
)


def test_daily_rule_capped_at_horizon() -> None:
    """A daily rule without COUNT/UNTIL should produce exactly 365 instances (1 year)."""
    start = date(2026, 1, 1)
    dates = generate_recurrence_dates(start, "FREQ=DAILY", max_horizon_days=365)
    horizon = start + timedelta(days=365)
    assert dates[0] == start
    assert all(d < horizon for d in dates)
    assert len(dates) == 365


def test_weekly_rule_capped_at_horizon() -> None:
    """A weekly rule without COUNT/UNTIL stays within the 365-day horizon."""
    start = date(2026, 1, 1)
    dates = generate_recurrence_dates(start, "FREQ=WEEKLY", max_horizon_days=365)
    horizon = start + timedelta(days=365)
    assert all(d < horizon for d in dates)
    # 365 days / 7 = 52.1 weeks; the 53rd occurrence (day 364) still falls within the horizon
    assert len(dates) == 53


def test_monthly_rule_capped_at_horizon() -> None:
    """A monthly rule without COUNT/UNTIL should produce exactly 12 instances in one year."""
    start = date(2026, 1, 1)
    dates = generate_recurrence_dates(start, "FREQ=MONTHLY", max_horizon_days=365)
    horizon = start + timedelta(days=365)
    assert all(d < horizon for d in dates)
    assert len(dates) == 12


def test_every_five_days_capped_at_horizon() -> None:
    """FREQ=DAILY;INTERVAL=5 should yield exactly 73 instances in 365 days."""
    start = date(2026, 1, 1)
    dates = generate_recurrence_dates(start, "FREQ=DAILY;INTERVAL=5", max_horizon_days=365)
    horizon = start + timedelta(days=365)
    assert all(d < horizon for d in dates)
    assert len(dates) == 73


def test_rule_with_count_respects_count_within_horizon() -> None:
    """A rule with COUNT=4 should produce exactly 4 instances regardless of horizon."""
    start = date(2026, 5, 21)
    dates = generate_recurrence_dates(start, "FREQ=WEEKLY;COUNT=4", max_horizon_days=365)
    assert len(dates) == 4


def test_rule_with_count_beyond_horizon_is_truncated() -> None:
    """A rule with a large COUNT that exceeds the horizon should be truncated."""
    start = date(2026, 1, 1)
    # FREQ=DAILY;COUNT=1000 would be 1000 days, but horizon is 30 days
    dates = generate_recurrence_dates(start, "FREQ=DAILY;COUNT=1000", max_horizon_days=30)
    horizon = start + timedelta(days=30)
    assert all(d < horizon for d in dates)
    assert len(dates) == 30  # days 0..29 inclusive (horizon day excluded)


def test_instances_backstop_prevents_runaway() -> None:
    """The max_instances backstop should cap output even if horizon is very large."""
    start = date(2026, 1, 1)
    dates = generate_recurrence_dates(start, "FREQ=DAILY", max_horizon_days=9999, max_instances=10)
    assert len(dates) == 10


def test_invalid_rrule_raises_validation_error() -> None:
    with pytest.raises(RecurrenceValidationError):
        generate_recurrence_dates(date(2026, 1, 1), "NOT_A_VALID_RRULE")


def test_through_date_generation_is_inclusive() -> None:
    start = date(2026, 5, 21)
    dates = generate_recurrence_dates(start, "FREQ=DAILY;COUNT=3", through_date=date(2026, 5, 23))
    assert dates == [date(2026, 5, 21), date(2026, 5, 22), date(2026, 5, 23)]


def test_through_date_generation_returns_empty_when_rule_is_exhausted() -> None:
    dates = generate_recurrence_dates(
        date(2026, 6, 1),
        "FREQ=DAILY;UNTIL=20260101T000000Z",
        through_date=date(2026, 6, 7),
    )
    assert dates == []


def test_through_date_generation_keeps_original_dtstart_for_count_rules() -> None:
    dates = generate_recurrence_dates(
        date(2026, 5, 22),
        "FREQ=WEEKLY;COUNT=4",
        dtstart=date(2026, 5, 21),
        through_date=date(2026, 6, 30),
    )
    assert dates == [date(2026, 5, 28), date(2026, 6, 4), date(2026, 6, 11)]


def test_exhausted_rule_returns_start_date() -> None:
    """A rule with UNTIL before start returns an empty list."""
    # UNTIL in the past relative to start_date → no occurrences
    start = date(2026, 6, 1)
    dates = generate_recurrence_dates(start, "FREQ=DAILY;UNTIL=20260101T000000Z")
    assert dates == []


def test_generate_recurrence_result_distinguishes_sparse_future_rules() -> None:
    result = generate_recurrence(
        date(2026, 5, 22),
        "FREQ=WEEKLY;COUNT=4",
        dtstart=date(2026, 5, 21),
        through_date=date(2026, 5, 27),
    )
    assert result.dates == []
    assert result.has_occurrence_after_horizon


def test_generate_recurrence_result_marks_count_exhausted() -> None:
    result = generate_recurrence(
        date(2026, 6, 12),
        "FREQ=WEEKLY;COUNT=4",
        dtstart=date(2026, 5, 21),
        through_date=date(2026, 6, 30),
    )
    assert result.dates == []
    assert not result.has_occurrence_after_horizon
