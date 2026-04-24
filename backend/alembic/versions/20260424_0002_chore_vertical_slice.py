"""add chore templates and instances

Revision ID: 20260424_0002
Revises: 20260423_0001
Create Date: 2026-04-24 00:00:00.000000
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260424_0002"
down_revision: str | None = "20260423_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chore_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("every_n_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chore_templates_user_id"), "chore_templates", ["user_id"], unique=False)

    chore_status = sa.Enum("pending", "completed", "skipped", name="chore_status")

    op.create_table(
        "chore_instances",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("chore_template_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("status", chore_status, server_default="pending", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("skipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["chore_template_id"], ["chore_templates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chore_template_id", "scheduled_date", name="uq_chore_instance_template_scheduled_date"),
    )
    op.create_index(op.f("ix_chore_instances_chore_template_id"), "chore_instances", ["chore_template_id"], unique=False)
    op.create_index(op.f("ix_chore_instances_scheduled_date"), "chore_instances", ["scheduled_date"], unique=False)
    op.create_index(op.f("ix_chore_instances_user_id"), "chore_instances", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chore_instances_user_id"), table_name="chore_instances")
    op.drop_index(op.f("ix_chore_instances_scheduled_date"), table_name="chore_instances")
    op.drop_index(op.f("ix_chore_instances_chore_template_id"), table_name="chore_instances")
    op.drop_table("chore_instances")

    chore_status = sa.Enum("pending", "completed", "skipped", name="chore_status")
    chore_status.drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_chore_templates_user_id"), table_name="chore_templates")
    op.drop_table("chore_templates")
