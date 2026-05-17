"""change medication_dose_instances.scheduled_at to timezone-naive

Scheduled times are wall-clock times entered by the user and should not
carry a UTC offset. Storing them as TIMESTAMP WITHOUT TIME ZONE keeps the
displayed time consistent regardless of the server or client timezone.

Revision ID: 20260516_0002
Revises: 20260516_0001
Create Date: 2026-05-16 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260516_0002"
down_revision: str | None = "20260516_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("medication_dose_instances") as batch_op:
        batch_op.alter_column(
            "scheduled_at",
            existing_type=sa.DateTime(timezone=True),
            type_=sa.DateTime(timezone=False),
            # For PostgreSQL: convert TIMESTAMPTZ → TIMESTAMP preserving the UTC value
            postgresql_using="scheduled_at AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    with op.batch_alter_table("medication_dose_instances") as batch_op:
        batch_op.alter_column(
            "scheduled_at",
            existing_type=sa.DateTime(timezone=False),
            type_=sa.DateTime(timezone=True),
            # For PostgreSQL: treat the stored naive value as UTC when restoring
            postgresql_using="scheduled_at AT TIME ZONE 'UTC'",
        )
