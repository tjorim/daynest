"""add priority and tags to planned_items and chore_templates

Revision ID: 20260521_0002
Revises: 20260521_0001
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0002"
down_revision: str | None = "20260521_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_PRIORITY_VALUES = ("low", "normal", "high", "urgent")
_PRIORITY_CHECK = f"priority IN {_PRIORITY_VALUES}"


def upgrade() -> None:
    op.add_column("planned_items", sa.Column("priority", sa.String(20), nullable=False, server_default="normal"))
    op.create_check_constraint("ck_planned_items_priority", "planned_items", _PRIORITY_CHECK)
    op.add_column("planned_items", sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("chore_templates", sa.Column("priority", sa.String(20), nullable=False, server_default="normal"))
    op.create_check_constraint("ck_chore_templates_priority", "chore_templates", _PRIORITY_CHECK)
    op.add_column("chore_templates", sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_constraint("ck_chore_templates_priority", "chore_templates")
    op.drop_column("chore_templates", "tags")
    op.drop_column("chore_templates", "priority")
    op.drop_constraint("ck_planned_items_priority", "planned_items")
    op.drop_column("planned_items", "tags")
    op.drop_column("planned_items", "priority")
