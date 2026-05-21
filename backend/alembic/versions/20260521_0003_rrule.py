"""add rrule field to routine_templates and chore_templates

Revision ID: 20260521_0003
Revises: 20260521_0002
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0003"
down_revision: str | None = "20260521_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("routine_templates", sa.Column("rrule", sa.String(500), nullable=True))
    op.add_column("chore_templates", sa.Column("rrule", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("routine_templates", "rrule")
    op.drop_column("chore_templates", "rrule")
