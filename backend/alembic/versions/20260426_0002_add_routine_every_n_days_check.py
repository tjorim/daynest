"""add check constraint every_n_days >= 1 on routine_templates

Revision ID: 20260426_0002
Revises: 20260423_0001
Create Date: 2026-04-26 00:00:00.000000
"""

from typing import Sequence

from alembic import op

revision: str = "20260426_0002"
down_revision: str | None = "20260423_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_routine_templates_every_n_days_positive",
        "routine_templates",
        "every_n_days >= 1",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_routine_templates_every_n_days_positive",
        "routine_templates",
        type_="check",
    )
