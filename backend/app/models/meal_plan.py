from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Index, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.meal_slot import MealSlot
    from app.models.user import User


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="meal_plans")
    slots: Mapped[list["MealSlot"]] = relationship(
        back_populates="meal_plan",
        cascade="all, delete-orphan",
        order_by="MealSlot.slot_date, MealSlot.slot_type",
    )


class MealSlot(Base):
    __tablename__ = "meal_slots"
    __table_args__ = (Index("uq_meal_slots_plan_date_type", "meal_plan_id", "slot_date", "slot_type", unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meal_plan_id: Mapped[int] = mapped_column(ForeignKey("meal_plans.id", ondelete="CASCADE"), nullable=False)
    slot_date: Mapped[date] = mapped_column(Date, nullable=False)
    slot_type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="", server_default="")
    recipe_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    ingredients_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    planned_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("planned_items.id", ondelete="SET NULL"), nullable=True, index=True
    )

    meal_plan: Mapped["MealPlan"] = relationship(back_populates="slots")
