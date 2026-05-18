"""add user timezone and convert medication scheduled_at to timestamptz

Adds users.timezone (IANA key, default UTC) so dose instances can be
generated as true UTC moments rather than naive wall-clock datetimes.
Existing naive values are reinterpreted as UTC (correct for existing data
since UTC was the only timezone in use).

Revision ID: 20260517_0001
Revises: 20260516_0001
Create Date: 2026-05-17 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260517_0001"
down_revision: str | None = "20260516_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("timezone", sa.String(length=100), server_default="UTC", nullable=False))
    with op.batch_alter_table("medication_dose_instances") as batch_op:
        batch_op.alter_column(
            "scheduled_at",
            existing_type=sa.DateTime(timezone=False),
            type_=sa.DateTime(timezone=True),
            postgresql_using="scheduled_at AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    op.drop_column("users", "timezone")
    with op.batch_alter_table("medication_dose_instances") as batch_op:
        batch_op.alter_column(
            "scheduled_at",
            existing_type=sa.DateTime(timezone=True),
            type_=sa.DateTime(timezone=False),
            postgresql_using="scheduled_at AT TIME ZONE 'UTC'",
        )
