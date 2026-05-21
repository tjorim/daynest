"""add user preference fields (snooze, medication reminder, quiet hours)

Revision ID: 20260521_0004
Revises: 20260521_0003
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0004"
down_revision: str | None = "20260521_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("default_snooze_days", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("users", sa.Column("medication_reminder_minutes", sa.Integer(), nullable=False, server_default="30"))
    op.add_column("users", sa.Column("quiet_hours_start", sa.Time(), nullable=True))
    op.add_column("users", sa.Column("quiet_hours_end", sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "default_snooze_days")
    op.drop_column("users", "medication_reminder_minutes")
    op.drop_column("users", "quiet_hours_start")
    op.drop_column("users", "quiet_hours_end")
