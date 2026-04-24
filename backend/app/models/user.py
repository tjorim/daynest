from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    routine_templates: Mapped[list["RoutineTemplate"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    task_instances: Mapped[list["TaskInstance"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    chore_templates: Mapped[list["ChoreTemplate"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    chore_instances: Mapped[list["ChoreInstance"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    medication_plans: Mapped[list["MedicationPlan"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    medication_dose_instances: Mapped[list["MedicationDoseInstance"]] = relationship(  # noqa: F821
        back_populates="user",
        cascade="all, delete-orphan",
    )
    planned_items: Mapped[list["PlannedItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    integration_clients: Mapped[list["IntegrationClient"]] = relationship(  # noqa: F821
        back_populates="user",
        cascade="all, delete-orphan",
    )
