from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import create_engine, inspect

from app.core.config import settings


def _missing_columns(columns: Iterable[str], expected: Iterable[str]) -> list[str]:
    available = set(columns)
    return [column for column in expected if column not in available]


def main() -> None:
    engine = create_engine(str(settings.database_url))
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    expected_tables = {
        "shopping_lists": "shopping lists growth module",
        "meal_plans": "meal planning growth module",
        "meal_slots": "meal planning slot grid",
        "recurrence_series": "recurring grocery auto-add support",
        "users": "calendar subscription token support",
    }
    missing_tables = [
        f"{table} ({label})"
        for table, label in expected_tables.items()
        if table not in tables
    ]
    if missing_tables:
        raise SystemExit(
            f"Missing growth migration tables: {', '.join(missing_tables)}"
        )

    expected_columns = {
        "shopping_lists": ("id", "user_id", "name", "store", "status", "notes"),
        "meal_plans": ("id", "user_id", "name", "week_start", "notes"),
        "meal_slots": (
            "id",
            "meal_plan_id",
            "slot_date",
            "slot_type",
            "title",
            "ingredients_json",
            "planned_item_id",
        ),
        "recurrence_series": ("auto_add_to_list_id",),
        "users": ("calendar_token",),
    }
    missing_columns: list[str] = []
    for table, columns in expected_columns.items():
        found = [column["name"] for column in inspector.get_columns(table)]
        missing_columns.extend(
            f"{table}.{column}" for column in _missing_columns(found, columns)
        )

    if missing_columns:
        raise SystemExit(
            f"Missing growth migration columns: {', '.join(missing_columns)}"
        )

    print("Growth migration schema check passed")


if __name__ == "__main__":
    main()
