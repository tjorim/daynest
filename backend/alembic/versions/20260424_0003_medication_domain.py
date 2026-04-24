"""add medication plans and dose instances

Revision ID: 20260424_0003
Revises: 20260424_0002
Create Date: 2026-04-24 00:30:00.000000
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260424_0003"
down_revision: str | None = "20260424_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
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
        sa.Column("instructions", sa.String(length=1000), nullable=False),
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
    op.create_index(
        op.f("ix_medication_dose_instances_medication_plan_id"),
        "medication_dose_instances",
        ["medication_plan_id"],
        unique=False,
    )
    op.create_index(op.f("ix_medication_dose_instances_scheduled_at"), "medication_dose_instances", ["scheduled_at"], unique=False)
    op.create_index(op.f("ix_medication_dose_instances_scheduled_date"), "medication_dose_instances", ["scheduled_date"], unique=False)
    op.create_index(op.f("ix_medication_dose_instances_user_id"), "medication_dose_instances", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_medication_dose_instances_user_id"), table_name="medication_dose_instances")
    op.drop_index(op.f("ix_medication_dose_instances_scheduled_date"), table_name="medication_dose_instances")
    op.drop_index(op.f("ix_medication_dose_instances_scheduled_at"), table_name="medication_dose_instances")
    op.drop_index(op.f("ix_medication_dose_instances_medication_plan_id"), table_name="medication_dose_instances")
    op.drop_table("medication_dose_instances")

    dose_status = sa.Enum("scheduled", "taken", "skipped", "missed", name="medication_dose_status")
    dose_status.drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_medication_plans_user_id"), table_name="medication_plans")
    op.drop_table("medication_plans")
