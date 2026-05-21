from __future__ import annotations

from datetime import datetime, time
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Integer, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.chore_instance import ChoreInstance
    from app.models.chore_template import ChoreTemplate
    from app.models.integration_client import IntegrationClient
    from app.models.medication_dose_instance import MedicationDoseInstance
    from app.models.medication_plan import MedicationPlan
    from app.models.planned_item import PlannedItem
    from app.models.refresh_token import RefreshToken
    from app.models.routine_template import RoutineTemplate
    from app.models.task_instance import TaskInstance


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(512), nullable=True)
    oidc_subject: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sa.text("true"))
    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="UTC", server_default="UTC")
    default_snooze_days: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    medication_reminder_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30, server_default="30")
    quiet_hours_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    quiet_hours_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    routine_templates: Mapped[list["RoutineTemplate"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    task_instances: Mapped[list["TaskInstance"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chore_templates: Mapped[list["ChoreTemplate"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chore_instances: Mapped[list["ChoreInstance"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    medication_plans: Mapped[list["MedicationPlan"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    medication_dose_instances: Mapped[list["MedicationDoseInstance"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    planned_items: Mapped[list["PlannedItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    integration_clients: Mapped[list["IntegrationClient"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
