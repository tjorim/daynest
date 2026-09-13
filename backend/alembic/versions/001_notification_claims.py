"""Add durable notification dispatch leases.

Revision ID: 001
Revises: 000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "001"
down_revision: str | None = "000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_claims",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("claim_token", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "notification_type", "item_id"),
    )
    op.create_index(op.f("ix_notification_claims_user_id"), "notification_claims", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_claims_user_id"), table_name="notification_claims")
    op.drop_table("notification_claims")
