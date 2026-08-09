"""Add audit_entries table for the shared REST/MCP transactional audit trail.

Revision ID: 003
Revises: 002
Create Date: 2026-08-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: str | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=False),
        sa.Column("auth_source", sa.String(length=32), nullable=False),
        sa.Column("integration_client_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    # No FK to users/integration_clients: audit rows must outlive the actor
    # they describe (account deletion, integration-client revocation) so the
    # trail stays intact — deliberately deviates from cascade-on-delete.
    op.create_index("ix_audit_entries_timestamp", "audit_entries", ["timestamp"])
    op.create_index("ix_audit_entries_actor_user_id", "audit_entries", ["actor_user_id"])
    op.create_index("ix_audit_entries_auth_source", "audit_entries", ["auth_source"])
    op.create_index("ix_audit_entries_integration_client_id", "audit_entries", ["integration_client_id"])
    op.create_index("ix_audit_entries_action", "audit_entries", ["action"])
    op.create_index("ix_audit_entries_resource_type", "audit_entries", ["resource_type"])
    op.create_index("ix_audit_entries_resource_id", "audit_entries", ["resource_id"])
    # Composite index matching list_audit_entries' primary access pattern:
    # scoped by actor, ordered by (timestamp desc, id desc).
    op.create_index(
        "ix_audit_entries_actor_timestamp_id",
        "audit_entries",
        ["actor_user_id", sa.text("timestamp DESC"), sa.text("id DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_entries_actor_timestamp_id", table_name="audit_entries")
    op.drop_index("ix_audit_entries_resource_id", table_name="audit_entries")
    op.drop_index("ix_audit_entries_resource_type", table_name="audit_entries")
    op.drop_index("ix_audit_entries_action", table_name="audit_entries")
    op.drop_index("ix_audit_entries_integration_client_id", table_name="audit_entries")
    op.drop_index("ix_audit_entries_auth_source", table_name="audit_entries")
    op.drop_index("ix_audit_entries_actor_user_id", table_name="audit_entries")
    op.drop_index("ix_audit_entries_timestamp", table_name="audit_entries")
    op.drop_table("audit_entries")
