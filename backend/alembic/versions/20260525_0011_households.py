"""add households, household_members; add household_id to chore_templates; add assigned_to and completed_by to chore_instances

Revision ID: 20260525_0011
Revises: 20260525_0010
Create Date: 2026-05-25 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260525_0011"
down_revision: str | None = "20260525_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "households",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "household_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), server_default="member", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("household_id", "user_id", name="uq_household_members_household_user"),
    )
    op.create_index("ix_household_members_household_id", "household_members", ["household_id"], unique=False)
    op.create_index("ix_household_members_user_id", "household_members", ["user_id"], unique=False)

    with op.batch_alter_table("chore_templates") as batch_op:
        batch_op.add_column(sa.Column("household_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_chore_templates_household_id",
            "households",
            ["household_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_chore_templates_household_id", ["household_id"], unique=False)

    with op.batch_alter_table("chore_instances") as batch_op:
        batch_op.add_column(sa.Column("assigned_to", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("completed_by", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_chore_instances_assigned_to",
            "users",
            ["assigned_to"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_chore_instances_completed_by",
            "users",
            ["completed_by"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("chore_instances") as batch_op:
        batch_op.drop_constraint("fk_chore_instances_completed_by", type_="foreignkey")
        batch_op.drop_constraint("fk_chore_instances_assigned_to", type_="foreignkey")
        batch_op.drop_column("completed_by")
        batch_op.drop_column("assigned_to")

    with op.batch_alter_table("chore_templates") as batch_op:
        batch_op.drop_index("ix_chore_templates_household_id")
        batch_op.drop_constraint("fk_chore_templates_household_id", type_="foreignkey")
        batch_op.drop_column("household_id")

    op.drop_index("ix_household_members_user_id", table_name="household_members")
    op.drop_index("ix_household_members_household_id", table_name="household_members")
    op.drop_table("household_members")
    op.drop_table("households")
