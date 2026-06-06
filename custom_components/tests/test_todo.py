"""Unit tests for custom_components.daynest.todo."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.daynest.todo import ENTITY_DESCRIPTION, DaynestShoppingListTodoEntity, DaynestTodoListEntity
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

        with pytest.raises(HomeAssistantError) as exc_info:
            await entity.async_update_todo_item("planned:201", {"status": COMPLETE_STATUS})
        assert exc_info.value.translation_key == "todo_planned_item_not_found"

    async def test_update_with_unsupported_status_raises(self) -> None:
        coordinator = _make_coordinator()
        entity = DaynestTodoListEntity(
            coordinator=coordinator,
            entity_description=ENTITY_DESCRIPTION,
        )

        with pytest.raises(HomeAssistantError) as exc_info:
            await entity.async_update_todo_item("due:101", {"status": TodoItemStatus.NEEDS_ACTION})
        assert exc_info.value.translation_key == "todo_complete_only"

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

        with pytest.raises(HomeAssistantError) as exc_info:
            await entity.async_create_todo_item(TodoItem(summary="", status=TodoItemStatus.NEEDS_ACTION))
        assert exc_info.value.translation_key == "todo_summary_required"


SHOPPING_COORDINATOR_DATA = {
    **COORDINATOR_DATA,
    "shopping_lists": [
        {"id": 301, "name": "Groceries", "status": "active"},
    ],
    "shopping_items": {
        301: [
            {
                "id": 401,
                "title": "Milk",
                "planned_for": "2026-01-15",
                "notes": "2 liters",
                "is_done": False,
                "tags": ["Dairy"],
            },
            {
                "id": 402,
                "title": "Bread",
                "planned_for": "2026-01-15",
                "is_done": True,
            },
        ],
    },
}


@pytest.mark.unit
class TestDaynestShoppingListTodoEntity:
    """Tests for DaynestShoppingListTodoEntity."""

    def test_shopping_list_items_map_to_todo_items(self) -> None:

        entity = DaynestShoppingListTodoEntity(
            coordinator=_make_coordinator(data=SHOPPING_COORDINATOR_DATA),
            shopping_list_id=301,
            shopping_list_name="Groceries",
        )

        items = entity.todo_items

        assert [item.summary for item in items] == ["Milk", "Bread"]
        assert [_item_id(item) for item in items] == ["shopping:401", "shopping:402"]
        assert [item.status for item in items] == [TodoItemStatus.NEEDS_ACTION, COMPLETE_STATUS]

    async def test_create_shopping_item_calls_client(self) -> None:

        coordinator = _make_coordinator(data=SHOPPING_COORDINATOR_DATA)
        entity = DaynestShoppingListTodoEntity(
            coordinator=coordinator,
            shopping_list_id=301,
            shopping_list_name="Groceries",
        )

        await entity.async_create_todo_item(
            TodoItem(
                summary="Eggs",
                due=entity._parse_due("2026-01-16"),
                status=TodoItemStatus.NEEDS_ACTION,
            )
        )

        coordinator.config_entry.runtime_data.client.async_create_shopping_item.assert_awaited_once_with(
            301,
            title="Eggs",
            planned_for="2026-01-16",
            notes=None,
        )
        coordinator.async_request_refresh.assert_awaited_once()

    async def test_update_shopping_item_calls_client(self) -> None:

        coordinator = _make_coordinator(data=SHOPPING_COORDINATOR_DATA)
        entity = DaynestShoppingListTodoEntity(
            coordinator=coordinator,
            shopping_list_id=301,
            shopping_list_name="Groceries",
        )

        await entity.async_update_todo_item(
            "shopping:401",
            {"summary": "Whole milk", "status": COMPLETE_STATUS},
        )

        coordinator.config_entry.runtime_data.client.async_update_shopping_item.assert_awaited_once()
        args = coordinator.config_entry.runtime_data.client.async_update_shopping_item.await_args.args
        kwargs = coordinator.config_entry.runtime_data.client.async_update_shopping_item.await_args.kwargs
        assert args == (301, 401)
        assert kwargs["title"] == "Whole milk"
        assert kwargs["is_done"] is True
        assert kwargs["tags"] == ["Dairy"]
        coordinator.async_request_refresh.assert_awaited_once()

    async def test_delete_shopping_item_calls_client(self) -> None:

        coordinator = _make_coordinator(data=SHOPPING_COORDINATOR_DATA)
        entity = DaynestShoppingListTodoEntity(
            coordinator=coordinator,
            shopping_list_id=301,
            shopping_list_name="Groceries",
        )

        await entity.async_delete_todo_items(["shopping:401"])

        coordinator.config_entry.runtime_data.client.async_delete_shopping_item.assert_awaited_once_with(401)
        coordinator.async_request_refresh.assert_awaited_once()
