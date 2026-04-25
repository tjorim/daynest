from __future__ import annotations

import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.medication_plan import MedicationPlan
    from app.models.user import User


class MedicationDoseStatus(str, enum.Enum):
    scheduled = "scheduled"
    taken = "taken"
    skipped = "skipped"
    missed = "missed"


class MedicationDoseInstance(Base):
    __tablename__ = "medication_dose_instances"
    __table_args__ = (UniqueConstraint("medication_plan_id", "scheduled_date", name="uq_med_dose_plan_scheduled_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    medication_plan_id: Mapped[int] = mapped_column(
        ForeignKey("medication_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[MedicationDoseStatus] = mapped_column(
        Enum(MedicationDoseStatus, name="medication_dose_status"),
        nullable=False,
        default=MedicationDoseStatus.scheduled,
        server_default=MedicationDoseStatus.scheduled.value,
    )
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    skipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    missed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="medication_dose_instances")
    medication_plan: Mapped["MedicationPlan"] = relationship(back_populates="dose_instances")
