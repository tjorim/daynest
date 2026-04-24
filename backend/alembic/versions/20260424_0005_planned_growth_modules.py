"""add optional planned item growth module metadata

Revision ID: 20260424_0005
Revises: 20260424_0004
Create Date: 2026-04-24 01:35:00.000000
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260424_0005"
down_revision: str | None = "20260424_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("planned_items", sa.Column("module_key", sa.String(length=50), nullable=True))
    op.add_column("planned_items", sa.Column("recurrence_hint", sa.String(length=255), nullable=True))
    op.add_column("planned_items", sa.Column("linked_source", sa.String(length=120), nullable=True))
    op.add_column("planned_items", sa.Column("linked_ref", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_planned_items_module_key"), "planned_items", ["module_key"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_planned_items_module_key"), table_name="planned_items")
    op.drop_column("planned_items", "linked_ref")
    op.drop_column("planned_items", "linked_source")
    op.drop_column("planned_items", "recurrence_hint")
    op.drop_column("planned_items", "module_key")
