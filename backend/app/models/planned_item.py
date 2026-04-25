from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class PlannedItem(Base):
    __tablename__ = "planned_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    module_key: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    recurrence_hint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linked_source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    linked_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    planned_for: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="planned_items")
