"""To-do platform for Daynest tasks due today."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from homeassistant.components.todo import TodoItem, TodoItemStatus, TodoListEntity, TodoListEntityFeature
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity import EntityDescription

from .const import DOMAIN, PARALLEL_UPDATES as PARALLEL_UPDATES
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

    _attr_supported_features = (
        TodoListEntityFeature.CREATE_TODO_ITEM
        |
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

        Supports due chore completion and planned item updates.
        """
        kind, raw_id = self._parse_item_id(item_id)
        client = self.coordinator.config_entry.runtime_data.client

        if kind == "due":
            status = changes.get("status")
            if status != COMPLETE_STATUS:
                raise HomeAssistantError(
                    translation_domain=DOMAIN,
                    translation_key="todo_complete_only",
                )

            await client.async_complete_task(raw_id)
            await self.coordinator.async_request_refresh()
            return

        planned_item = self._find_planned_item(raw_id)
        if planned_item is None:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="todo_planned_item_not_found",
                translation_placeholders={"item_id": str(raw_id)},
            )

        status = changes.get("status")
        if status is None:
            status = COMPLETE_STATUS if planned_item.get("is_done") else TodoItemStatus.NEEDS_ACTION
        summary = str(changes.get("summary", planned_item.get("title") or "Task")).strip()
        if not summary:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="todo_title_empty",
            )
        planned_for = self._format_due_for_payload(changes.get("due", planned_item.get("planned_for")))
        notes = changes.get("description", planned_item.get("notes"))

        await client.async_update_planned_item(
            planned_item_id=raw_id,
            title=summary,
            planned_for=planned_for,
            is_done=self._is_complete_status(status),
            notes=notes,
            module_key=planned_item.get("module_key"),
            recurrence_hint=planned_item.get("recurrence_hint"),
            linked_source=planned_item.get("linked_source"),
            linked_ref=planned_item.get("linked_ref"),
        )
        await self.coordinator.async_request_refresh()

    async def async_create_todo_item(self, item: TodoItem) -> None:
        """Create a planned Daynest item from Home Assistant."""
        summary = str(item.summary or "").strip()
        if not summary:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="todo_summary_required",
            )

        await self.coordinator.config_entry.runtime_data.client.async_create_planned_item(
            title=summary,
            planned_for=self._format_due_for_payload(item.due),
            notes=item.description,
        )
        await self.coordinator.async_request_refresh()

    async def async_delete_todo_items(self, item_ids: list[str]) -> None:
        """Delete todo items.

        For due-today chore items, delete maps to skip-task.
        For planned items, delete removes the planned item.
        """
        client = self.coordinator.config_entry.runtime_data.client
        for item_id in item_ids:
            kind, raw_id = self._parse_item_id(item_id)
            if kind == "due":
                await client.async_skip_task(raw_id)
            else:
                await client.async_delete_planned_item(raw_id)

        await self.coordinator.async_request_refresh()

    def _build_items(self, source: Any, *, id_key: str, kind: str) -> list[TodoItem]:
        """Build Home Assistant todo items from a payload list."""
        if not isinstance(source, list):
            return []

        items: list[TodoItem] = []
        for item in source:
            if not isinstance(item, dict):
                continue

            item_id = self._format_item_id(kind, item.get(id_key))
            if item_id is None:
                continue
            status = self._status_from_item(item)
            summary = str(item.get("title") or "Task")
            due_value = item.get("scheduled_date") or item.get("planned_for")
            due = self._parse_due(due_value)

            kwargs: dict[str, Any] = {
                "summary": summary,
                "status": status,
            }
            notes = item.get("notes")
            if isinstance(notes, str) and notes.strip():
                kwargs["description"] = notes
            if due is not None:
                kwargs["due"] = due

            try:
                items.append(TodoItem(item_id=item_id, **kwargs))
            except TypeError:
                items.append(TodoItem(uid=item_id, **kwargs))

        return items

    def _format_item_id(self, kind: str, raw_id: Any) -> str | None:
        """Build a stable item ID string from Daynest IDs."""
        try:
            parsed_id = int(raw_id)
        except (TypeError, ValueError):
            return None
        if parsed_id <= 0:
            return None
        return f"{kind}:{parsed_id}"

    def _parse_item_id(self, item_id: str) -> tuple[str, int]:
        """Parse item IDs encoded as '<kind>:<id>'."""
        kind, separator, raw_id = item_id.partition(":")
        if not separator or kind not in {"due", "planned"}:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="todo_invalid_item_id",
                translation_placeholders={"item_id": item_id},
            )
        try:
            parsed_id = int(raw_id)
        except ValueError as err:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="todo_invalid_item_id",
                translation_placeholders={"item_id": item_id},
            ) from err
        if parsed_id <= 0:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="todo_invalid_item_id",
                translation_placeholders={"item_id": item_id},
            )
        return kind, parsed_id

    def _is_complete_status(self, status: Any) -> bool:
        """Return true when status maps to a completed todo item."""
        if status == COMPLETE_STATUS:
            return True
        if isinstance(status, str) and status.lower() in {"completed", "complete"}:
            return True
        return False

    def _format_due_for_payload(self, value: Any) -> str:
        """Serialize due values into YYYY-MM-DD for planned-item write calls."""
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value).date().isoformat()
            except ValueError:
                try:
                    return date.fromisoformat(value).isoformat()
                except ValueError:
                    pass
        fallback = self.coordinator.data.get("for_date") if isinstance(self.coordinator.data, dict) else None
        if isinstance(fallback, str):
            try:
                return date.fromisoformat(fallback).isoformat()
            except ValueError:
                pass
        return date.today().isoformat()

    def _find_planned_item(self, planned_item_id: int) -> dict[str, Any] | None:
        """Find a planned item by ID in the current coordinator payload."""
        if not isinstance(self.coordinator.data, dict):
            return None
        planned_items = self.coordinator.data.get("planned")
        if not isinstance(planned_items, list):
            return None
        for item in planned_items:
            if not isinstance(item, dict):
                continue
            if self._format_item_id("planned", item.get("id")) == f"planned:{planned_item_id}":
                return item
        return None

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
