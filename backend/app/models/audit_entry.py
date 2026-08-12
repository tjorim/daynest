from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditEntry(Base):
    """Immutable record of a mutation performed through REST or MCP.

    Written in the same database transaction as the mutation it describes so
    that a mutation can never be reported as successful without a matching
    audit row (and vice versa) — see app.services.audit_service.write_audit_entry.
    """

    __tablename__ = "audit_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    actor_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    auth_source: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    integration_client_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    resource_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        # Matches alembic 003 composite index matching list_audit_entries' primary
        # access pattern: scoped by actor, ordered by (timestamp DESC, id DESC).
        Index(
            "ix_audit_entries_actor_timestamp_id",
            "actor_user_id",
            sa.text("timestamp DESC"),
            sa.text("id DESC"),
        ),
    )
