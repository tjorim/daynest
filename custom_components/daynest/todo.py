"""To-do platform for Daynest tasks due today."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from homeassistant.components.todo import TodoItem, TodoItemStatus, TodoListEntity
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
        items.extend(self._build_items(self.coordinator.data.get("due_today"), id_key="chore_instance_id"))
        items.extend(self._build_items(self.coordinator.data.get("planned"), id_key="id"))
        return items

    def _build_items(self, source: Any, *, id_key: str) -> list[TodoItem]:
        """Build Home Assistant todo items from a payload list."""
        if not isinstance(source, list):
            return []

        items: list[TodoItem] = []
        for index, item in enumerate(source):
            if not isinstance(item, dict):
                continue

            item_id = str(item.get(id_key, index))
            status = self._status_from_item(item)
            summary = str(item.get("title") or "Task")
            due_value = item.get("scheduled_date") or item.get("planned_for")
            due = self._parse_due(due_value)

            fields = set(getattr(TodoItem, "__annotations__", {})) | set(getattr(TodoItem, "__dataclass_fields__", {}))
            kwargs: dict[str, Any] = {
                "summary": summary,
                "status": status,
            }
            if "item_id" in fields:
                kwargs["item_id"] = item_id
            else:
                kwargs["uid"] = item_id
            if due is not None:
                kwargs["due"] = due

            items.append(TodoItem(**kwargs))

        return items

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
