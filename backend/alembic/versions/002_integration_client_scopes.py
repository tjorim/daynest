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
    op.add_column(
        "integration_clients",
        sa.Column(
            "scopes",
            sa.JSON(),
            nullable=False,
            server_default='["integration:*"]',
        ),
    )


def downgrade() -> None:
    op.drop_column("integration_clients", "scopes")
