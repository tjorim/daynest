"""Unit tests for custom_components.daynest.todo."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from daynest.todo import ENTITY_DESCRIPTION, DaynestTodoListEntity
from homeassistant.components.todo import TodoItem, TodoItemStatus
from homeassistant.exceptions import HomeAssistantError

try:
    COMPLETE_STATUS = TodoItemStatus.COMPLETE
except AttributeError:
    COMPLETE_STATUS = TodoItemStatus.COMPLETED

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
    coordinator.config_entry.runtime_data.client = AsyncMock()
    coordinator.async_request_refresh = AsyncMock()
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
        assert [_item_id(item) for item in items] == ["due:101", "due:102", "planned:201", "planned:202"]

    def test_builds_ids_with_kind_prefix(self) -> None:
        entity = DaynestTodoListEntity(
            coordinator=_make_coordinator(),
            entity_description=ENTITY_DESCRIPTION,
        )
        items = entity.todo_items
        assert _item_id(items[0]) == "due:101"
        assert _item_id(items[2]) == "planned:201"

    def test_skips_items_missing_required_id_key(self) -> None:
        data = {
            **COORDINATOR_DATA,
            "due_today": [{"title": "No ID", "status": "pending"}],
            "planned": [{"id": None, "title": "Bad planned", "is_done": False}],
        }
        entity = DaynestTodoListEntity(
            coordinator=_make_coordinator(data=data),
            entity_description=ENTITY_DESCRIPTION,
        )
        assert entity.todo_items == []

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

    async def test_update_marks_due_task_complete(self) -> None:
        coordinator = _make_coordinator()
        entity = DaynestTodoListEntity(
            coordinator=coordinator,
            entity_description=ENTITY_DESCRIPTION,
        )

        await entity.async_update_todo_item("due:101", {"status": COMPLETE_STATUS})

        coordinator.config_entry.runtime_data.client.async_complete_task.assert_awaited_once_with(101)
        coordinator.async_request_refresh.assert_awaited_once()

    async def test_update_for_planned_item_raises(self) -> None:
        coordinator = _make_coordinator()
        entity = DaynestTodoListEntity(
            coordinator=coordinator,
            entity_description=ENTITY_DESCRIPTION,
        )

        await entity.async_update_todo_item(
            "planned:201",
            {
                "status": COMPLETE_STATUS,
                "summary": "Plan meals and snacks",
            },
        )

        coordinator.config_entry.runtime_data.client.async_update_planned_item.assert_awaited_once()
        call_kwargs = coordinator.config_entry.runtime_data.client.async_update_planned_item.await_args.kwargs
        assert call_kwargs["planned_item_id"] == 201
        assert call_kwargs["title"] == "Plan meals and snacks"
        assert call_kwargs["is_done"] is True
        coordinator.async_request_refresh.assert_awaited_once()

    async def test_update_for_missing_planned_item_raises(self) -> None:
        coordinator = _make_coordinator()
        coordinator.data = {**COORDINATOR_DATA, "planned": []}
        entity = DaynestTodoListEntity(
            coordinator=coordinator,
            entity_description=ENTITY_DESCRIPTION,
        )

        with pytest.raises(HomeAssistantError, match="Unable to locate planned item for id 201"):
            await entity.async_update_todo_item("planned:201", {"status": COMPLETE_STATUS})

    async def test_update_with_unsupported_status_raises(self) -> None:
        coordinator = _make_coordinator()
        entity = DaynestTodoListEntity(
            coordinator=coordinator,
            entity_description=ENTITY_DESCRIPTION,
        )

        with pytest.raises(HomeAssistantError, match="Only marking due-today chore items as complete is supported"):
            await entity.async_update_todo_item("due:101", {"status": TodoItemStatus.NEEDS_ACTION})

    async def test_delete_due_items_maps_to_skip(self) -> None:
        coordinator = _make_coordinator()
        entity = DaynestTodoListEntity(
            coordinator=coordinator,
            entity_description=ENTITY_DESCRIPTION,
        )

        await entity.async_delete_todo_items(["due:101", "due:102"])

        coordinator.config_entry.runtime_data.client.async_skip_task.assert_any_await(101)
        coordinator.config_entry.runtime_data.client.async_skip_task.assert_any_await(102)
        assert coordinator.config_entry.runtime_data.client.async_skip_task.await_count == 2
        coordinator.async_request_refresh.assert_awaited_once()

    async def test_delete_planned_item_raises(self) -> None:
        coordinator = _make_coordinator()
        entity = DaynestTodoListEntity(
            coordinator=coordinator,
            entity_description=ENTITY_DESCRIPTION,
        )

        await entity.async_delete_todo_items(["planned:201"])

        coordinator.config_entry.runtime_data.client.async_delete_planned_item.assert_awaited_once_with(201)
        coordinator.async_request_refresh.assert_awaited_once()

    async def test_create_todo_item_creates_planned_item(self) -> None:
        coordinator = _make_coordinator()
        entity = DaynestTodoListEntity(
            coordinator=coordinator,
            entity_description=ENTITY_DESCRIPTION,
        )

        await entity.async_create_todo_item(
            TodoItem(
                summary="New planned task",
                due=entity._parse_due("2026-01-16"),
                status=TodoItemStatus.NEEDS_ACTION,
            )
        )

        coordinator.config_entry.runtime_data.client.async_create_planned_item.assert_awaited_once_with(
            title="New planned task",
            planned_for="2026-01-16",
            notes=None,
        )
        coordinator.async_request_refresh.assert_awaited_once()

    async def test_create_todo_item_requires_summary(self) -> None:
        coordinator = _make_coordinator()
        entity = DaynestTodoListEntity(
            coordinator=coordinator,
            entity_description=ENTITY_DESCRIPTION,
        )

        with pytest.raises(HomeAssistantError, match="Todo item summary is required"):
            await entity.async_create_todo_item(TodoItem(summary="", status=TodoItemStatus.NEEDS_ACTION))
