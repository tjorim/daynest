"""Unit tests for custom_components.daynest.todo."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from daynest.todo import DaynestTodoListEntity, ENTITY_DESCRIPTION
from homeassistant.components.todo import TodoItemStatus

COMPLETE_STATUS = getattr(TodoItemStatus, "COMPLETE", getattr(TodoItemStatus, "COMPLETED"))

COORDINATOR_DATA = {
    "for_date": "2026-01-15",
    "due_today": [
        {
            "chore_instance_id": 101,
            "title": "Take out trash",
            "status": "pending",
            "scheduled_date": "2026-01-15",
        },
        {
            "chore_instance_id": 102,
            "title": "Water plants",
            "status": "completed",
            "scheduled_date": "2026-01-15",
        },
    ],
    "planned": [
        {
            "id": 201,
            "title": "Plan meals",
            "planned_for": "2026-01-15",
            "is_done": False,
        },
        {
            "id": 202,
            "title": "Buy groceries",
            "planned_for": "2026-01-15",
            "is_done": True,
        },
    ],
}


def _make_coordinator(data: dict | None = COORDINATOR_DATA) -> MagicMock:
    coordinator = MagicMock()
    coordinator.data = data
    coordinator.config_entry.entry_id = "test_entry_id"
    coordinator.config_entry.domain = "daynest"
    coordinator.config_entry.title = "Daynest Test"
    return coordinator


def _item_id(item: object) -> str | None:
    return getattr(item, "item_id", None) or getattr(item, "uid", None)


@pytest.mark.unit
class TestDaynestTodoListEntity:
    """Tests for DaynestTodoListEntity.todo_items."""

    def test_combines_due_today_and_planned_items(self) -> None:
        entity = DaynestTodoListEntity(
            coordinator=_make_coordinator(),
            entity_description=ENTITY_DESCRIPTION,
        )

        items = entity.todo_items

        assert len(items) == 4
        assert [item.summary for item in items] == [
            "Take out trash",
            "Water plants",
            "Plan meals",
            "Buy groceries",
        ]
        assert [_item_id(item) for item in items] == ["101", "102", "201", "202"]

    def test_maps_status_to_home_assistant_todo_status(self) -> None:
        entity = DaynestTodoListEntity(
            coordinator=_make_coordinator(),
            entity_description=ENTITY_DESCRIPTION,
        )

        items = entity.todo_items

        assert [item.status for item in items] == [
            TodoItemStatus.NEEDS_ACTION,
            COMPLETE_STATUS,
            TodoItemStatus.NEEDS_ACTION,
            COMPLETE_STATUS,
        ]

    def test_returns_empty_list_when_coordinator_data_is_none(self) -> None:
        entity = DaynestTodoListEntity(
            coordinator=_make_coordinator(),
            entity_description=ENTITY_DESCRIPTION,
        )
        entity.coordinator.data = None
        assert entity.todo_items == []

    def test_ignores_invalid_due_today_and_planned_values(self) -> None:
        entity = DaynestTodoListEntity(
            coordinator=_make_coordinator(data={"due_today": "invalid", "planned": {"oops": True}}),
            entity_description=ENTITY_DESCRIPTION,
        )
        assert entity.todo_items == []
