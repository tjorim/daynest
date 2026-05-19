"""Daynest API response models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from daynest.exceptions import DaynestMalformedResponseError


@dataclass(slots=True, frozen=True)
class DaynestSummary:
    """Typed model for the ``/summary`` payload."""

    payload: dict[str, Any]

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> DaynestSummary:
        """Build a typed summary model from a raw JSON payload."""
        if not isinstance(payload, dict):
            msg = "Malformed summary payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        required_keys = {
            "sensor_daynest_chores_due",
            "sensor_daynest_routines_open",
            "sensor_daynest_medication_due",
            "sensor_daynest_planned_remaining",
            "sensor_daynest_overdue_count",
            "sensor_daynest_next_medication",
        }
        missing_keys = sorted(required_keys.difference(payload))
        if missing_keys:
            missing = ", ".join(missing_keys)
            msg = f"Malformed summary payload: missing required keys ({missing})"
            raise DaynestMalformedResponseError(msg)
        return cls(payload=payload)


@dataclass(slots=True, frozen=True)
class DaynestDashboard:
    """Typed model for the ``/dashboard`` payload."""

    payload: dict[str, Any]

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> DaynestDashboard:
        """Build a typed dashboard model from a raw JSON payload."""
        if not isinstance(payload, dict):
            msg = "Malformed dashboard payload: expected JSON object"
            raise DaynestMalformedResponseError(msg)
        required_keys = {
            "for_date",
            "due_today_count",
            "overdue_count",
            "planned_count",
            "medication_due_count",
            "completion_ratio",
            "next_medication",
        }
        missing_keys = sorted(required_keys.difference(payload))
        if missing_keys:
            missing = ", ".join(missing_keys)
            msg = f"Malformed dashboard payload: missing required keys ({missing})"
            raise DaynestMalformedResponseError(msg)
        return cls(payload=payload)


ModelT = TypeVar("ModelT")


@dataclass(slots=True, frozen=True)
class DaynestApiResponse(Generic[ModelT]):
    """Typed response wrapper carrying contract metadata."""

    data: ModelT
    integration_contract: str | None
