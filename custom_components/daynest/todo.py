"""To-do platform for Daynest tasks due today."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from homeassistant.components.todo import TodoItem, TodoItemStatus, TodoListEntity, TodoListEntityFeature
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity import EntityDescription

from .entity import DaynestEntity

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    from .coordinator import DaynestDataUpdateCoordinator
    from .data import DaynestConfigEntry

ENTITY_DESCRIPTION = EntityDescription(
    key="tasks_due_today",
    translation_key="tasks_due_today",
)
try:
    COMPLETE_STATUS = TodoItemStatus.COMPLETE
except AttributeError:  # pragma: no cover - compatibility with enum name changes across HA versions
    COMPLETE_STATUS = TodoItemStatus.COMPLETED


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DaynestConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Daynest to-do entities for a config entry."""
    async_add_entities(
        [
            DaynestTodoListEntity(
                coordinator=entry.runtime_data.coordinator,
                entity_description=ENTITY_DESCRIPTION,
            )
        ]
    )


class DaynestTodoListEntity(TodoListEntity, DaynestEntity):
    """Expose due-today and planned Daynest tasks as a Home Assistant to-do list."""

    _attr_icon = "mdi:format-list-checks"
    _attr_supported_features = (
        TodoListEntityFeature.UPDATE_TODO_ITEM
        | TodoListEntityFeature.DELETE_TODO_ITEM
    )

    def __init__(
        self,
        coordinator: DaynestDataUpdateCoordinator,
        entity_description: EntityDescription,
    ) -> None:
        """Initialize the to-do entity."""
        super().__init__(coordinator, entity_description)

    @property
    def todo_items(self) -> list[TodoItem]:
        """Return current task items from the coordinator payload."""
        if self.coordinator.data is None:
            return []

        items: list[TodoItem] = []
        items.extend(self._build_items(self.coordinator.data.get("due_today"), id_key="chore_instance_id", kind="due"))
        items.extend(self._build_items(self.coordinator.data.get("planned"), id_key="id", kind="planned"))
        return items

    async def async_update_todo_item(self, item_id: str, changes: dict[str, Any]) -> None:
        """Update a todo item.

        Supports marking due-today chore items as complete.
        """
        kind, raw_id = self._parse_item_id(item_id)
        if kind != "due":
            msg = "Only due-today chore items can be updated from Home Assistant."
            raise HomeAssistantError(msg)

        status = changes.get("status")
        if status != COMPLETE_STATUS:
            msg = "Only marking due-today chore items as complete is supported."
            raise HomeAssistantError(msg)

        await self.coordinator.config_entry.runtime_data.client.async_complete_task(raw_id)
        await self.coordinator.async_request_refresh()

    async def async_delete_todo_items(self, item_ids: list[str]) -> None:
        """Delete todo items.

        For due-today chore items, delete maps to skip-task.
        """
        for item_id in item_ids:
            kind, raw_id = self._parse_item_id(item_id)
            if kind != "due":
                msg = "Only due-today chore items can be deleted from Home Assistant."
                raise HomeAssistantError(msg)
            await self.coordinator.config_entry.runtime_data.client.async_skip_task(raw_id)

        await self.coordinator.async_request_refresh()

    def _build_items(self, source: Any, *, id_key: str, kind: str) -> list[TodoItem]:
        """Build Home Assistant todo items from a payload list."""
        if not isinstance(source, list):
            return []

        items: list[TodoItem] = []
        for index, item in enumerate(source):
            if not isinstance(item, dict):
                continue

            raw_id = item.get(id_key, index)
            item_id = f"{kind}:{raw_id}"
            status = self._status_from_item(item)
            summary = str(item.get("title") or "Task")
            due_value = item.get("scheduled_date") or item.get("planned_for")
            due = self._parse_due(due_value)

            kwargs: dict[str, Any] = {
                "summary": summary,
                "status": status,
            }
            if due is not None:
                kwargs["due"] = due

            try:
                items.append(TodoItem(item_id=item_id, **kwargs))
            except TypeError:
                items.append(TodoItem(uid=item_id, **kwargs))

        return items

    def _parse_item_id(self, item_id: str) -> tuple[str, int]:
        """Parse item IDs encoded as '<kind>:<id>'."""
        kind, separator, raw_id = item_id.partition(":")
        if not separator or kind not in {"due", "planned"}:
            msg = f"Unsupported Daynest to-do item id: {item_id}"
            raise HomeAssistantError(msg)
        try:
            parsed_id = int(raw_id)
        except ValueError as err:
            msg = f"Unsupported Daynest to-do item id: {item_id}"
            raise HomeAssistantError(msg) from err
        return kind, parsed_id

    def _status_from_item(self, item: dict[str, Any]) -> TodoItemStatus:
        """Convert Daynest item status to Home Assistant to-do status."""
        raw_status = item.get("status")
        if isinstance(raw_status, str) and raw_status.lower() in {"completed", "complete", "done", "skipped", "taken"}:
            return COMPLETE_STATUS
        if item.get("is_done") is True:
            return COMPLETE_STATUS
        return TodoItemStatus.NEEDS_ACTION

    def _parse_due(self, value: Any) -> datetime | None:
        """Parse due date values from coordinator data into datetime objects."""
        if not isinstance(value, str):
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
