"""Add durable integration-client lifecycle metadata.

Revision ID: 004
Revises: 003
Create Date: 2026-08-09 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "integration_clients",
        sa.Column("key_preview", sa.String(length=8), nullable=True),
    )
    op.add_column(
        "integration_clients",
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "integration_clients",
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("audit_entries", sa.Column("subject", sa.String(length=255), nullable=True))
    op.add_column(
        "integration_clients",
        sa.Column("rate_limit_window_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "integration_clients",
        sa.Column("rate_limit_window_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("integration_clients", "rate_limit_window_count")
    op.drop_column("integration_clients", "rate_limit_window_started_at")
    op.drop_column("audit_entries", "subject")
    op.drop_column("integration_clients", "revoked_at")
    op.drop_column("integration_clients", "last_used_at")
    op.drop_column("integration_clients", "key_preview")
