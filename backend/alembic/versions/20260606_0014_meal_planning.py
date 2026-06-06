"""add meal planning tables

Revision ID: 20260606_0014
Revises: 20260606_0013
Create Date: 2026-06-06 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260606_0014"
down_revision: str | None = "20260606_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "meal_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_meal_plans_user_id"), "meal_plans", ["user_id"], unique=False)
    op.create_index(op.f("ix_meal_plans_week_start"), "meal_plans", ["week_start"], unique=False)

    op.create_table(
        "meal_slots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meal_plan_id", sa.Integer(), nullable=False),
        sa.Column("slot_date", sa.Date(), nullable=False),
        sa.Column("slot_type", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), server_default="", nullable=False),
        sa.Column("recipe_url", sa.Text(), nullable=True),
        sa.Column(
            "ingredients_json",
            postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"),
            server_default="[]",
            nullable=False,
        ),
        sa.Column("planned_item_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["meal_plan_id"], ["meal_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["planned_item_id"], ["planned_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("uq_meal_slots_plan_date_type", "meal_slots", ["meal_plan_id", "slot_date", "slot_type"], unique=True)
    op.create_index(op.f("ix_meal_slots_planned_item_id"), "meal_slots", ["planned_item_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_meal_slots_planned_item_id"), table_name="meal_slots")
    op.drop_index("uq_meal_slots_plan_date_type", table_name="meal_slots")
    op.drop_table("meal_slots")
    op.drop_index(op.f("ix_meal_plans_week_start"), table_name="meal_plans")
    op.drop_index(op.f("ix_meal_plans_user_id"), table_name="meal_plans")
    op.drop_table("meal_plans")
