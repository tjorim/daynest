"""add recurring grocery auto-add shopping list link

Revision ID: 20260606_0013
Revises: 20260602_0012
Create Date: 2026-06-06 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260606_0013"
down_revision: str | None = "20260602_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("recurrence_series", sa.Column("auto_add_to_list_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_recurrence_series_auto_add_to_list_id_shopping_lists",
        "recurrence_series",
        "shopping_lists",
        ["auto_add_to_list_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_recurrence_series_auto_add_to_list_id",
        "recurrence_series",
        ["auto_add_to_list_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_recurrence_series_auto_add_to_list_id", table_name="recurrence_series")
    op.drop_constraint(
        "fk_recurrence_series_auto_add_to_list_id_shopping_lists",
        "recurrence_series",
        type_="foreignkey",
    )
    op.drop_column("recurrence_series", "auto_add_to_list_id")
