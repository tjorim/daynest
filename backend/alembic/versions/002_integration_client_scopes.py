"""Add explicit scopes to integration clients.

Revision ID: 002
Revises: 001
Create Date: 2026-07-27 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Backfill existing rows with the migration-only compatibility scope so
    # credentials created before explicit scopes existed keep working.
    op.add_column(
        "integration_clients",
        sa.Column(
            "scopes",
            sa.JSON(),
            nullable=False,
            server_default='["integration:*"]',
        ),
    )
    # New rows (including any raw insert that omits scopes) should default to
    # least-privilege, not the unrestricted legacy compatibility scope.
    op.alter_column(
        "integration_clients",
        "scopes",
        server_default='["home_assistant:*"]',
    )


def downgrade() -> None:
    op.drop_column("integration_clients", "scopes")
