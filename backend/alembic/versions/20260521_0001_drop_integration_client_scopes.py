"""drop scopes_csv from integration_clients

Integration clients are personal access tokens — any valid key grants full
access, same as an OIDC session. Granular scope controls have been removed.

Revision ID: 20260521_0001
Revises: 20260517_0001
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0001"
down_revision: str | None = "20260517_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("integration_clients", "scopes_csv")


def downgrade() -> None:
    op.add_column(
        "integration_clients",
        sa.Column("scopes_csv", sa.String(255), nullable=False, server_default=""),
    )
