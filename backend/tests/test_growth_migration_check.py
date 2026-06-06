from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from scripts.check_growth_migrations import main


def test_growth_migration_check_accepts_model_schema(
    db_session: Session,
    monkeypatch,
) -> None:
    bind = db_session.get_bind()
    monkeypatch.setattr("scripts.check_growth_migrations.create_engine", lambda _: bind)

    main()


def test_growth_migration_check_reports_missing_growth_table(
    monkeypatch, tmp_path
) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'missing.db'}")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            table for table in Base.metadata.sorted_tables if table.name != "meal_slots"
        ],
    )
    monkeypatch.setattr(
        "scripts.check_growth_migrations.create_engine", lambda _: engine
    )

    try:
        main()
    except SystemExit as exc:
        assert "meal_slots" in str(exc)
    else:
        raise AssertionError(
            "Expected missing meal_slots to fail growth migration check"
        )
