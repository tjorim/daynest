from __future__ import annotations

from datetime import date, datetime, time
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.medication_dose_instance import MedicationDoseInstance
    from app.models.user import User


class MedicationPlan(Base):
    __tablename__ = "medication_plans"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_medication_plan_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    schedule_time: Mapped[time] = mapped_column(Time(), nullable=False)
    every_n_days: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sa.text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="medication_plans")
    dose_instances: Mapped[list["MedicationDoseInstance"]] = relationship(
        back_populates="medication_plan",
        cascade="all, delete-orphan",
    )
