"""initial schema

Revision ID: 20260423_0001
Revises:
Create Date: 2026-04-23 00:00:00.000000
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260423_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "routine_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_routine_templates_user_id"), "routine_templates", ["user_id"], unique=False)

    task_status = sa.Enum("pending", "in_progress", "completed", "skipped", name="task_status")
    task_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "task_instances",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("routine_template_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", task_status, server_default="pending", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["routine_template_id"], ["routine_templates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_instances_routine_template_id"), "task_instances", ["routine_template_id"], unique=False)
    op.create_index(op.f("ix_task_instances_scheduled_date"), "task_instances", ["scheduled_date"], unique=False)
    op.create_index(op.f("ix_task_instances_user_id"), "task_instances", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_task_instances_user_id"), table_name="task_instances")
    op.drop_index(op.f("ix_task_instances_scheduled_date"), table_name="task_instances")
    op.drop_index(op.f("ix_task_instances_routine_template_id"), table_name="task_instances")
    op.drop_table("task_instances")

    task_status = sa.Enum("pending", "in_progress", "completed", "skipped", name="task_status")
    task_status.drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_routine_templates_user_id"), table_name="routine_templates")
    op.drop_table("routine_templates")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
