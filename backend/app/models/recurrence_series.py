from __future__ import annotations

from datetime import date, datetime, time
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import Date, DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import Priority
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.planned_item import PlannedItem
    from app.models.user import User


class RecurrenceSeries(Base):
    __tablename__ = "recurrence_series"

    id: Mapped[UUID] = mapped_column(sa.Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    rrule: Mapped[str] = mapped_column(String(500), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    time_of_day: Mapped[time | None] = mapped_column(sa.Time(), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(sa.Integer(), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    module_key: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    recurrence_hint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linked_source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    linked_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    priority: Mapped[Priority] = mapped_column(
        String(20),
        nullable=False,
        default=Priority.normal,
        server_default="normal",
    )
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    materialized_through: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="recurrence_series")
    planned_items: Mapped[list["PlannedItem"]] = relationship(back_populates="recurrence_series")
