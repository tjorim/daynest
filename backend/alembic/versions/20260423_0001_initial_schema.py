"""initial schema — squashed, all tables at final cumulative state

IMPORTANT — PRODUCTION DEPLOYMENT NOTE
=======================================
This migration replaces the entire previous migration chain (formerly 19
files, revisions 20260423_0001 through 20260607_0015 / 20260606_0016) with a
single migration that reproduces the exact same end-state schema. No schema
changes are introduced by this squash — it is a pure bookkeeping change.

The production database has already run the full original chain, so its
`alembic_version` table is stamped at the old final revision (20260606_0016).
Since this squash changes revision IDs, production must NOT run a normal
`alembic upgrade head` against this revision. Instead, a human must run:

    alembic stamp 20260423_0001

against production *after* this PR is reviewed, to re-point `alembic_version`
at the new sole revision without touching the (unchanged) schema. Running
`alembic upgrade head` on a database that already has this schema, without
stamping first, will fail because the tables/types already exist.

Excluded from the squash: the data-backfill statements in the old
20260525_0010 migration (which populated `recurrence_series` from existing
`planned_items` rows, and nulled out orphaned `recurrence_series_id` values)
were dropped — they are no-ops on a fresh/empty database. The DDL from that
migration (the `recurrence_series` table itself, plus the FK and unique
constraint it added to `planned_items`) is fully preserved below, inlined
into the relevant `CREATE TABLE` blocks.

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
        sa.Column("password_hash", sa.String(length=512), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("oidc_subject", sa.String(length=255), nullable=True),
        sa.Column(
            "timezone", sa.String(length=100), server_default="UTC", nullable=False
        ),
        sa.Column(
            "default_snooze_days", sa.Integer(), server_default="1", nullable=False
        ),
        sa.Column(
            "medication_reminder_minutes",
            sa.Integer(),
            server_default="30",
            nullable=False,
        ),
        sa.Column("quiet_hours_start", sa.Time(), nullable=True),
        sa.Column("quiet_hours_end", sa.Time(), nullable=True),
        sa.Column("calendar_token", sa.String(length=64), nullable=True),
        sa.Column(
            "push_overdue_chores_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "push_medication_reminders_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "push_missed_medications_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("calendar_feed_token", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index("ix_users_oidc_subject", "users", ["oidc_subject"], unique=True)
    op.create_index("ix_users_calendar_token", "users", ["calendar_token"], unique=True)
    op.create_index(
        "ix_users_calendar_feed_token", "users", ["calendar_feed_token"], unique=True
    )

    op.create_table(
        "households",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "household_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "role", sa.String(length=20), server_default="member", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["household_id"], ["households.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "household_id", "user_id", name="uq_household_members_household_user"
        ),
    )
    op.create_index(
        "ix_household_members_household_id",
        "household_members",
        ["household_id"],
        unique=False,
    )
    op.create_index(
        "ix_household_members_user_id", "household_members", ["user_id"], unique=False
    )

    op.create_table(
        "integration_clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("key_hash", sa.String(length=128), nullable=False),
        sa.Column(
            "rate_limit_per_minute", sa.Integer(), nullable=False, server_default="120"
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_integration_clients_key_hash"),
        "integration_clients",
        ["key_hash"],
        unique=True,
    )
    op.create_index(
        op.f("ix_integration_clients_user_id"),
        "integration_clients",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "routine_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("every_n_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column("due_time", sa.Time(), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("rrule", sa.String(length=500), nullable=True),
        sa.CheckConstraint(
            "every_n_days >= 1", name="ck_routine_templates_every_n_days_positive"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_routine_templates_user_id"),
        "routine_templates",
        ["user_id"],
        unique=False,
    )

    task_status = sa.Enum(
        "pending", "in_progress", "completed", "skipped", name="task_status"
    )

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
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["routine_template_id"], ["routine_templates.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "routine_template_id",
            "scheduled_date",
            name="uq_task_instance_template_scheduled_date",
        ),
    )
    op.create_index(
        op.f("ix_task_instances_routine_template_id"),
        "task_instances",
        ["routine_template_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_task_instances_scheduled_date"),
        "task_instances",
        ["scheduled_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_task_instances_user_id"), "task_instances", ["user_id"], unique=False
    )

    op.create_table(
        "chore_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("every_n_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "priority", sa.String(length=20), server_default="normal", nullable=False
        ),
        sa.Column("tags", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("rrule", sa.String(length=500), nullable=True),
        sa.Column("household_id", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name="ck_chore_templates_priority",
        ),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="SET NULL",
            name="fk_chore_templates_household_id",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_chore_templates_user_id"), "chore_templates", ["user_id"], unique=False
    )
    op.create_index(
        "ix_chore_templates_household_id",
        "chore_templates",
        ["household_id"],
        unique=False,
    )

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
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("assigned_to", sa.Integer(), nullable=True),
        sa.Column("completed_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["chore_template_id"], ["chore_templates.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["assigned_to"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_chore_instances_assigned_to",
        ),
        sa.ForeignKeyConstraint(
            ["completed_by"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_chore_instances_completed_by",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "chore_template_id",
            "scheduled_date",
            name="uq_chore_instance_template_scheduled_date",
        ),
    )
    op.create_index(
        op.f("ix_chore_instances_chore_template_id"),
        "chore_instances",
        ["chore_template_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chore_instances_scheduled_date"),
        "chore_instances",
        ["scheduled_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chore_instances_user_id"), "chore_instances", ["user_id"], unique=False
    )

    op.create_table(
        "medication_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("schedule_time", sa.Time(), nullable=False),
        sa.Column("every_n_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_medication_plan_user_name"),
    )
    op.create_index(
        op.f("ix_medication_plans_user_id"),
        "medication_plans",
        ["user_id"],
        unique=False,
    )

    dose_status = sa.Enum(
        "scheduled", "taken", "skipped", "missed", name="medication_dose_status"
    )

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
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["medication_plan_id"], ["medication_plans.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "medication_plan_id",
            "scheduled_date",
            name="uq_med_dose_plan_scheduled_date",
        ),
    )
    op.create_index(
        op.f("ix_medication_dose_instances_medication_plan_id"),
        "medication_dose_instances",
        ["medication_plan_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_medication_dose_instances_scheduled_at"),
        "medication_dose_instances",
        ["scheduled_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_medication_dose_instances_scheduled_date"),
        "medication_dose_instances",
        ["scheduled_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_medication_dose_instances_user_id"),
        "medication_dose_instances",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "shopping_lists",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("store", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), server_default="active", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_shopping_lists_user_status",
        "shopping_lists",
        ["user_id", "status"],
        unique=False,
    )

    op.create_table(
        "recurrence_series",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("rrule", sa.String(length=500), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("time_of_day", sa.Time(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("module_key", sa.String(length=50), nullable=True),
        sa.Column("recurrence_hint", sa.String(length=255), nullable=True),
        sa.Column("linked_source", sa.String(length=120), nullable=True),
        sa.Column("linked_ref", sa.String(length=255), nullable=True),
        sa.Column(
            "priority", sa.String(length=20), server_default="normal", nullable=False
        ),
        sa.Column("tags", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("materialized_through", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("auto_add_to_list_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["auto_add_to_list_id"],
            ["shopping_lists.id"],
            ondelete="SET NULL",
            name="fk_recurrence_series_auto_add_to_list_id_shopping_lists",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_recurrence_series_user_id", "recurrence_series", ["user_id"], unique=False
    )
    op.create_index(
        "ix_recurrence_series_module_key",
        "recurrence_series",
        ["module_key"],
        unique=False,
    )
    op.create_index(
        "ix_recurrence_series_auto_add_to_list_id",
        "recurrence_series",
        ["auto_add_to_list_id"],
        unique=False,
    )

    op.create_table(
        "planned_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("planned_for", sa.Date(), nullable=False),
        sa.Column(
            "is_done", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("module_key", sa.String(length=50), nullable=True),
        sa.Column("recurrence_hint", sa.String(length=255), nullable=True),
        sa.Column("linked_source", sa.String(length=120), nullable=True),
        sa.Column("linked_ref", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "priority", sa.String(length=20), server_default="normal", nullable=False
        ),
        sa.Column("tags", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("rrule", sa.String(length=500), nullable=True),
        sa.Column("recurrence_series_id", sa.Uuid(), nullable=True),
        sa.Column("time_of_day", sa.Time(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name="ck_planned_items_priority",
        ),
        sa.ForeignKeyConstraint(
            ["recurrence_series_id"],
            ["recurrence_series.id"],
            ondelete="CASCADE",
            name="fk_planned_items_recurrence_series_id",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "recurrence_series_id",
            "planned_for",
            name="uq_planned_items_series_planned_for",
        ),
    )
    op.create_index(
        op.f("ix_planned_items_module_key"),
        "planned_items",
        ["module_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_planned_items_planned_for"),
        "planned_items",
        ["planned_for"],
        unique=False,
    )
    op.create_index(
        op.f("ix_planned_items_user_id"), "planned_items", ["user_id"], unique=False
    )
    op.create_index(
        "ix_planned_items_recurrence_series_id",
        "planned_items",
        ["recurrence_series_id"],
        unique=False,
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("jti", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_refresh_tokens_jti"), "refresh_tokens", ["jti"], unique=True
    )
    op.create_index(
        op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False
    )

    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("platform", sa.String(length=20), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh", sa.Text(), nullable=True),
        sa.Column("auth", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.CheckConstraint(
            "platform IN ('fcm', 'webpush')", name="ck_push_subscriptions_platform"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("endpoint"),
    )
    op.create_index(
        "ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"], unique=False
    )

    op.create_table(
        "notifications_sent",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "notification_type", "item_id"),
    )
    op.create_index(
        op.f("ix_notifications_sent_user_id"),
        "notifications_sent",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "meal_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_meal_plans_user_id"), "meal_plans", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_meal_plans_week_start"), "meal_plans", ["week_start"], unique=False
    )

    op.create_table(
        "meal_slots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meal_plan_id", sa.Integer(), nullable=False),
        sa.Column("slot_date", sa.Date(), nullable=False),
        sa.Column("slot_type", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), server_default="", nullable=False),
        sa.Column("recipe_url", sa.Text(), nullable=True),
        sa.Column("ingredients_json", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("planned_item_id", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "slot_type IN ('breakfast', 'lunch', 'dinner', 'snack')",
            name="ck_meal_slots_slot_type",
        ),
        sa.ForeignKeyConstraint(
            ["meal_plan_id"], ["meal_plans.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["planned_item_id"], ["planned_items.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_meal_slots_plan_date_type",
        "meal_slots",
        ["meal_plan_id", "slot_date", "slot_type"],
        unique=True,
    )
    op.create_index(
        op.f("ix_meal_slots_planned_item_id"),
        "meal_slots",
        ["planned_item_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_meal_slots_planned_item_id"), table_name="meal_slots")
    op.drop_index("uq_meal_slots_plan_date_type", table_name="meal_slots")
    op.drop_table("meal_slots")

    op.drop_index(op.f("ix_meal_plans_week_start"), table_name="meal_plans")
    op.drop_index(op.f("ix_meal_plans_user_id"), table_name="meal_plans")
    op.drop_table("meal_plans")

    op.drop_index(
        op.f("ix_notifications_sent_user_id"), table_name="notifications_sent"
    )
    op.drop_table("notifications_sent")

    op.drop_index("ix_push_subscriptions_user_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")

    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_index(op.f("ix_refresh_tokens_jti"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index("ix_planned_items_recurrence_series_id", table_name="planned_items")
    op.drop_index(op.f("ix_planned_items_user_id"), table_name="planned_items")
    op.drop_index(op.f("ix_planned_items_planned_for"), table_name="planned_items")
    op.drop_index(op.f("ix_planned_items_module_key"), table_name="planned_items")
    op.drop_table("planned_items")

    op.drop_index(
        "ix_recurrence_series_auto_add_to_list_id", table_name="recurrence_series"
    )
    op.drop_index("ix_recurrence_series_module_key", table_name="recurrence_series")
    op.drop_index("ix_recurrence_series_user_id", table_name="recurrence_series")
    op.drop_table("recurrence_series")

    op.drop_index("ix_shopping_lists_user_status", table_name="shopping_lists")
    op.drop_table("shopping_lists")

    op.drop_index(
        op.f("ix_medication_dose_instances_user_id"),
        table_name="medication_dose_instances",
    )
    op.drop_index(
        op.f("ix_medication_dose_instances_scheduled_date"),
        table_name="medication_dose_instances",
    )
    op.drop_index(
        op.f("ix_medication_dose_instances_scheduled_at"),
        table_name="medication_dose_instances",
    )
    op.drop_index(
        op.f("ix_medication_dose_instances_medication_plan_id"),
        table_name="medication_dose_instances",
    )
    op.drop_table("medication_dose_instances")
    sa.Enum(name="medication_dose_status").drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_medication_plans_user_id"), table_name="medication_plans")
    op.drop_table("medication_plans")

    op.drop_index(op.f("ix_chore_instances_user_id"), table_name="chore_instances")
    op.drop_index(
        op.f("ix_chore_instances_scheduled_date"), table_name="chore_instances"
    )
    op.drop_index(
        op.f("ix_chore_instances_chore_template_id"), table_name="chore_instances"
    )
    op.drop_table("chore_instances")
    sa.Enum(name="chore_status").drop(op.get_bind(), checkfirst=True)

    op.drop_index("ix_chore_templates_household_id", table_name="chore_templates")
    op.drop_index(op.f("ix_chore_templates_user_id"), table_name="chore_templates")
    op.drop_table("chore_templates")

    op.drop_index(op.f("ix_task_instances_user_id"), table_name="task_instances")
    op.drop_index(op.f("ix_task_instances_scheduled_date"), table_name="task_instances")
    op.drop_index(
        op.f("ix_task_instances_routine_template_id"), table_name="task_instances"
    )
    op.drop_table("task_instances")
    sa.Enum(name="task_status").drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_routine_templates_user_id"), table_name="routine_templates")
    op.drop_table("routine_templates")

    op.drop_index(
        op.f("ix_integration_clients_user_id"), table_name="integration_clients"
    )
    op.drop_index(
        op.f("ix_integration_clients_key_hash"), table_name="integration_clients"
    )
    op.drop_table("integration_clients")

    op.drop_index("ix_household_members_user_id", table_name="household_members")
    op.drop_index("ix_household_members_household_id", table_name="household_members")
    op.drop_table("household_members")

    op.drop_table("households")

    op.drop_index("ix_users_calendar_feed_token", table_name="users")
    op.drop_index("ix_users_calendar_token", table_name="users")
    op.drop_index("ix_users_oidc_subject", table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
