"""add calendar_token to users

Revision ID: 20260521_0005
Revises: 20260521_0004
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0005"
down_revision: str | None = "20260521_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("calendar_token", sa.String(64), nullable=True))
    op.create_index("ix_users_calendar_token", "users", ["calendar_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_calendar_token", table_name="users")
    op.drop_column("users", "calendar_token")
