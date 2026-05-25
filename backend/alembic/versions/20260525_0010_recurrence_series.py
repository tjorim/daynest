"""add recurrence_series table and planned_items linkage

Revision ID: 20260525_0010
Revises: 20260524_0009
Create Date: 2026-05-25 00:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260525_0010"
down_revision: str | None = "20260524_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recurrence_series",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("rrule", sa.String(length=500), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("time_of_day", sa.Time(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("module_key", sa.String(length=50), nullable=True),
        sa.Column("recurrence_hint", sa.String(length=255), nullable=True),
        sa.Column("linked_source", sa.String(length=120), nullable=True),
        sa.Column("linked_ref", sa.String(length=255), nullable=True),
        sa.Column("priority", sa.String(length=20), server_default="normal", nullable=False),
        sa.Column("tags", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("materialized_through", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_recurrence_series_user_id", "recurrence_series", ["user_id"], unique=False)
    op.create_index("ix_recurrence_series_module_key", "recurrence_series", ["module_key"], unique=False)

    bind = op.get_bind()
    planned_items = sa.table(
        "planned_items",
        sa.column("id", sa.Integer()),
        sa.column("user_id", sa.Integer()),
        sa.column("title", sa.String()),
        sa.column("rrule", sa.String()),
        sa.column("planned_for", sa.Date()),
        sa.column("time_of_day", sa.Time()),
        sa.column("duration_minutes", sa.Integer()),
        sa.column("notes", sa.Text()),
        sa.column("module_key", sa.String()),
        sa.column("recurrence_hint", sa.String()),
        sa.column("linked_source", sa.String()),
        sa.column("linked_ref", sa.String()),
        sa.column("priority", sa.String()),
        sa.column("tags", sa.JSON()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("recurrence_series_id", sa.Uuid()),
    )
    recurrence_series = sa.table(
        "recurrence_series",
        sa.column("id", sa.Uuid()),
        sa.column("user_id", sa.Integer()),
        sa.column("title", sa.String()),
        sa.column("rrule", sa.String()),
        sa.column("start_date", sa.Date()),
        sa.column("time_of_day", sa.Time()),
        sa.column("duration_minutes", sa.Integer()),
        sa.column("notes", sa.Text()),
        sa.column("module_key", sa.String()),
        sa.column("recurrence_hint", sa.String()),
        sa.column("linked_source", sa.String()),
        sa.column("linked_ref", sa.String()),
        sa.column("priority", sa.String()),
        sa.column("tags", sa.JSON()),
        sa.column("materialized_through", sa.Date()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )

    series_ids = bind.execute(
        sa.select(planned_items.c.recurrence_series_id)
        .where(planned_items.c.recurrence_series_id.is_not(None))
        .group_by(planned_items.c.recurrence_series_id)
    ).all()

    for (series_id,) in series_ids:
        first_row = bind.execute(
            sa.select(
                planned_items.c.user_id,
                planned_items.c.title,
                planned_items.c.rrule,
                planned_items.c.planned_for,
                planned_items.c.time_of_day,
                planned_items.c.duration_minutes,
                planned_items.c.notes,
                planned_items.c.module_key,
                planned_items.c.recurrence_hint,
                planned_items.c.linked_source,
                planned_items.c.linked_ref,
                planned_items.c.priority,
                planned_items.c.tags,
                planned_items.c.created_at,
            )
            .where(planned_items.c.recurrence_series_id == series_id)
            .order_by(planned_items.c.planned_for.asc(), planned_items.c.id.asc())
            .limit(1)
        ).first()
        if first_row is None or first_row.rrule is None:
            continue
        materialized_through = bind.execute(
            sa.select(sa.func.max(planned_items.c.planned_for))
            .where(planned_items.c.recurrence_series_id == series_id)
        ).scalar_one()
        bind.execute(
            sa.insert(recurrence_series).values(
                id=series_id,
                user_id=first_row.user_id,
                title=first_row.title,
                rrule=first_row.rrule,
                start_date=first_row.planned_for,
                time_of_day=first_row.time_of_day,
                duration_minutes=first_row.duration_minutes,
                notes=first_row.notes,
                module_key=first_row.module_key,
                recurrence_hint=first_row.recurrence_hint,
                linked_source=first_row.linked_source,
                linked_ref=first_row.linked_ref,
                priority=first_row.priority,
                tags=first_row.tags or [],
                materialized_through=materialized_through,
                created_at=first_row.created_at,
            )
        )

    bind.execute(
        sa.update(planned_items)
        .where(planned_items.c.recurrence_series_id.is_not(None))
        .where(
            planned_items.c.recurrence_series_id.not_in(
                sa.select(recurrence_series.c.id)
            )
        )
        .values(recurrence_series_id=None)
    )

    op.create_foreign_key(
        "fk_planned_items_recurrence_series_id",
        "planned_items",
        "recurrence_series",
        ["recurrence_series_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_planned_items_series_planned_for",
        "planned_items",
        ["recurrence_series_id", "planned_for"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_planned_items_series_planned_for", "planned_items", type_="unique")
    op.drop_constraint("fk_planned_items_recurrence_series_id", "planned_items", type_="foreignkey")
    op.drop_index("ix_recurrence_series_module_key", table_name="recurrence_series")
    op.drop_index("ix_recurrence_series_user_id", table_name="recurrence_series")
    op.drop_table("recurrence_series")
