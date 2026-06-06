"""add calendar feed token

Revision ID: 20260606_0016
Revises: 20260607_0015
Create Date: 2026-06-06 00:16:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260606_0016"
down_revision: str | None = "20260607_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("calendar_feed_token", sa.String(64), nullable=True))
    op.create_index("ix_users_calendar_feed_token", "users", ["calendar_feed_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_calendar_feed_token", table_name="users")
    op.drop_column("users", "calendar_feed_token")
