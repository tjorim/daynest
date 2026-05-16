"""add oidc_subject to users, make password_hash nullable

Revision ID: 20260516_0001
Revises: 20260501_0001
Create Date: 2026-05-16 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260516_0001"
down_revision: str | None = "20260501_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("oidc_subject", sa.String(255), nullable=True))
        batch_op.alter_column("password_hash", existing_type=sa.String(512), nullable=True)
        batch_op.create_index("ix_users_oidc_subject", ["oidc_subject"], unique=True)


def downgrade() -> None:
    op.execute("UPDATE users SET password_hash = '' WHERE password_hash IS NULL")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_oidc_subject")
        batch_op.drop_column("oidc_subject")
        batch_op.alter_column("password_hash", existing_type=sa.String(512), nullable=False)
