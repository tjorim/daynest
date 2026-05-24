"""planned item time and duration

Revision ID: 20260524_0009
Revises: 20260521_0008
Create Date: 2026-05-24 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260524_0009"
down_revision: str | None = "20260521_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("planned_items", sa.Column("time_of_day", sa.Time(), nullable=True))
    op.add_column("planned_items", sa.Column("duration_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("planned_items", "duration_minutes")
    op.drop_column("planned_items", "time_of_day")
