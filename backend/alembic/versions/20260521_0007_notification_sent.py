"""record sent push notifications

Revision ID: 20260521_0007
Revises: 20260521_0006
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0007"
down_revision: str | None = "20260521_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notifications_sent",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "notification_type", "item_id"),
    )
    op.create_index(op.f("ix_notifications_sent_user_id"), "notifications_sent", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_sent_user_id"), table_name="notifications_sent")
    op.drop_table("notifications_sent")
