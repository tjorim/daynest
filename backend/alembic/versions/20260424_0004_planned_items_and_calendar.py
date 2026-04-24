"""add planned items domain

Revision ID: 20260424_0004
Revises: 20260424_0003
Create Date: 2026-04-24 00:45:00.000000
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260424_0004"
down_revision: str | None = "20260424_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "planned_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("planned_for", sa.Date(), nullable=False),
        sa.Column("is_done", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_planned_items_user_id"), "planned_items", ["user_id"], unique=False)
    op.create_index(op.f("ix_planned_items_planned_for"), "planned_items", ["planned_for"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_planned_items_planned_for"), table_name="planned_items")
    op.drop_index(op.f("ix_planned_items_user_id"), table_name="planned_items")
    op.drop_table("planned_items")
