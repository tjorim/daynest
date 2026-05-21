"""add push notification preference fields

Revision ID: 20260521_0008
Revises: 20260521_0007
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0008"
down_revision: str | None = "20260521_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("push_overdue_chores_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "users",
        sa.Column("push_medication_reminders_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "users",
        sa.Column("push_missed_medications_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("users", "push_missed_medications_enabled")
    op.drop_column("users", "push_medication_reminders_enabled")
    op.drop_column("users", "push_overdue_chores_enabled")
