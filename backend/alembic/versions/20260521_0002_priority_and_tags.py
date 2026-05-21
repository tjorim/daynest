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
    with op.batch_alter_table("planned_items") as batch:
        batch.add_column(sa.Column("priority", sa.String(20), nullable=False, server_default="normal"))
        batch.add_column(sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"))
        batch.create_check_constraint("ck_planned_items_priority", _PRIORITY_CHECK)

    with op.batch_alter_table("chore_templates") as batch:
        batch.add_column(sa.Column("priority", sa.String(20), nullable=False, server_default="normal"))
        batch.add_column(sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"))
        batch.create_check_constraint("ck_chore_templates_priority", _PRIORITY_CHECK)


def downgrade() -> None:
    with op.batch_alter_table("chore_templates") as batch:
        batch.drop_constraint("ck_chore_templates_priority", type_="check")
        batch.drop_column("tags")
        batch.drop_column("priority")

    with op.batch_alter_table("planned_items") as batch:
        batch.drop_constraint("ck_planned_items_priority", type_="check")
        batch.drop_column("tags")
        batch.drop_column("priority")
