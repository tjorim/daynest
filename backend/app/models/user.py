from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.chore_instance import ChoreInstance
    from app.models.chore_template import ChoreTemplate
    from app.models.integration_client import IntegrationClient
    from app.models.medication_dose_instance import MedicationDoseInstance
    from app.models.medication_plan import MedicationPlan
    from app.models.planned_item import PlannedItem
    from app.models.routine_template import RoutineTemplate
    from app.models.task_instance import TaskInstance


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
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
