"""add check constraint on meal_slots.slot_type

Revision ID: 20260607_0015
Revises: 20260606_0014
Create Date: 2026-06-07 00:00:00.000000
"""

from typing import Sequence

from alembic import op

revision: str = "20260607_0015"
down_revision: str | None = "20260606_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_meal_slots_slot_type",
        "meal_slots",
        "slot_type IN ('breakfast', 'lunch', 'dinner', 'snack')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_meal_slots_slot_type", "meal_slots", type_="check")
