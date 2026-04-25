"""initial schema

Revision ID: 20260423_0001
Revises:
Create Date: 2026-04-23 00:00:00.000000
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa

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
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "integration_clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("key_hash", sa.String(length=128), nullable=False),
        sa.Column("scopes_csv", sa.String(length=255), nullable=False),
        sa.Column("rate_limit_per_minute", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_integration_clients_key_hash"), "integration_clients", ["key_hash"], unique=True)
    op.create_index(op.f("ix_integration_clients_user_id"), "integration_clients", ["user_id"], unique=False)

    op.create_table(
        "routine_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("every_n_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column("due_time", sa.Time(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_routine_templates_user_id"), "routine_templates", ["user_id"], unique=False)

    task_status = sa.Enum("pending", "in_progress", "completed", "skipped", name="task_status")

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
        sa.UniqueConstraint("routine_template_id", "scheduled_date", name="uq_task_instance_template_scheduled_date"),
    )
    op.create_index(op.f("ix_task_instances_routine_template_id"), "task_instances", ["routine_template_id"], unique=False)
    op.create_index(op.f("ix_task_instances_scheduled_date"), "task_instances", ["scheduled_date"], unique=False)
    op.create_index(op.f("ix_task_instances_user_id"), "task_instances", ["user_id"], unique=False)

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

    op.create_table(
        "medication_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("schedule_time", sa.Time(), nullable=False),
        sa.Column("every_n_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_medication_plan_user_name"),
    )
    op.create_index(op.f("ix_medication_plans_user_id"), "medication_plans", ["user_id"], unique=False)

    dose_status = sa.Enum("scheduled", "taken", "skipped", "missed", name="medication_dose_status")

    op.create_table(
        "medication_dose_instances",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("medication_plan_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", dose_status, server_default="scheduled", nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("skipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("missed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["medication_plan_id"], ["medication_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("medication_plan_id", "scheduled_date", name="uq_med_dose_plan_scheduled_date"),
    )
    op.create_index(op.f("ix_medication_dose_instances_medication_plan_id"), "medication_dose_instances", ["medication_plan_id"], unique=False)
    op.create_index(op.f("ix_medication_dose_instances_scheduled_at"), "medication_dose_instances", ["scheduled_at"], unique=False)
    op.create_index(op.f("ix_medication_dose_instances_scheduled_date"), "medication_dose_instances", ["scheduled_date"], unique=False)
    op.create_index(op.f("ix_medication_dose_instances_user_id"), "medication_dose_instances", ["user_id"], unique=False)

    op.create_table(
        "planned_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("planned_for", sa.Date(), nullable=False),
        sa.Column("is_done", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("module_key", sa.String(length=50), nullable=True),
        sa.Column("recurrence_hint", sa.String(length=255), nullable=True),
        sa.Column("linked_source", sa.String(length=120), nullable=True),
        sa.Column("linked_ref", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_planned_items_module_key"), "planned_items", ["module_key"], unique=False)
    op.create_index(op.f("ix_planned_items_planned_for"), "planned_items", ["planned_for"], unique=False)
    op.create_index(op.f("ix_planned_items_user_id"), "planned_items", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_planned_items_user_id"), table_name="planned_items")
    op.drop_index(op.f("ix_planned_items_planned_for"), table_name="planned_items")
    op.drop_index(op.f("ix_planned_items_module_key"), table_name="planned_items")
    op.drop_table("planned_items")

    op.drop_index(op.f("ix_medication_dose_instances_user_id"), table_name="medication_dose_instances")
    op.drop_index(op.f("ix_medication_dose_instances_scheduled_date"), table_name="medication_dose_instances")
    op.drop_index(op.f("ix_medication_dose_instances_scheduled_at"), table_name="medication_dose_instances")
    op.drop_index(op.f("ix_medication_dose_instances_medication_plan_id"), table_name="medication_dose_instances")
    op.drop_table("medication_dose_instances")
    sa.Enum(name="medication_dose_status").drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_medication_plans_user_id"), table_name="medication_plans")
    op.drop_table("medication_plans")

    op.drop_index(op.f("ix_chore_instances_user_id"), table_name="chore_instances")
    op.drop_index(op.f("ix_chore_instances_scheduled_date"), table_name="chore_instances")
    op.drop_index(op.f("ix_chore_instances_chore_template_id"), table_name="chore_instances")
    op.drop_table("chore_instances")
    sa.Enum(name="chore_status").drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_chore_templates_user_id"), table_name="chore_templates")
    op.drop_table("chore_templates")

    op.drop_index(op.f("ix_task_instances_user_id"), table_name="task_instances")
    op.drop_index(op.f("ix_task_instances_scheduled_date"), table_name="task_instances")
    op.drop_index(op.f("ix_task_instances_routine_template_id"), table_name="task_instances")
    op.drop_table("task_instances")
    sa.Enum(name="task_status").drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_routine_templates_user_id"), table_name="routine_templates")
    op.drop_table("routine_templates")

    op.drop_index(op.f("ix_integration_clients_user_id"), table_name="integration_clients")
    op.drop_index(op.f("ix_integration_clients_key_hash"), table_name="integration_clients")
    op.drop_table("integration_clients")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
