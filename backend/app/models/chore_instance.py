import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChoreStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    skipped = "skipped"


class ChoreInstance(Base):
    __tablename__ = "chore_instances"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    chore_template_id: Mapped[int] = mapped_column(
        ForeignKey("chore_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[ChoreStatus] = mapped_column(
        Enum(ChoreStatus, name="chore_status"),
        nullable=False,
        default=ChoreStatus.pending,
        server_default=ChoreStatus.pending.value,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    skipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="chore_instances")
    chore_template: Mapped["ChoreTemplate"] = relationship(back_populates="chore_instances")
