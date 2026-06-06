from datetime import date
from typing import cast

from fastapi import HTTPException, status

from app.core.enums import Priority
from app.models.shopping_list import ShoppingList
from app.repositories.shopping_list_repository import ShoppingListRepository
from app.schemas.shopping_list import (
    ShoppingListCreateRequest,
    ShoppingListResponse,
    ShoppingListStatus,
    ShoppingListUpdateRequest,
)
from app.schemas.today import (
    PlannedItemCreateRequest,
    PlannedItemModuleKey,
    PlannedItemUpdateRequest,
)
from app.services.today_service import TodayService


class ShoppingListService:
    def __init__(self, repository: ShoppingListRepository, today_service: TodayService):
        self.repository = repository
        self.today_service = today_service

    def list_shopping_lists(
        self, user_id: int, status_filter: ShoppingListStatus | None = "active"
    ) -> list[ShoppingListResponse]:
        return [
            self._to_schema(shopping_list)
            for shopping_list in self.repository.list_by_user(
                user_id, status=status_filter
            )
        ]

    def get_shopping_list(
        self, user_id: int, shopping_list_id: int
    ) -> ShoppingListResponse:
        shopping_list = self._get_user_shopping_list(user_id, shopping_list_id)
        return self._to_schema(shopping_list)

    def create_shopping_list(
        self, user_id: int, request: ShoppingListCreateRequest
    ) -> ShoppingListResponse:
        shopping_list = self.repository.create(
            ShoppingList(
                user_id=user_id,
                name=request.name,
                store=request.store,
                notes=request.notes,
                status="active",
            )
        )
        return self._to_schema(shopping_list)

    def update_shopping_list(
        self, user_id: int, shopping_list_id: int, request: ShoppingListUpdateRequest
    ) -> ShoppingListResponse:
        shopping_list = self._get_user_shopping_list(user_id, shopping_list_id)
        if "name" in request.model_fields_set:
            shopping_list.name = request.name
        if "store" in request.model_fields_set:
            shopping_list.store = request.store
        if "notes" in request.model_fields_set:
            shopping_list.notes = request.notes
        if "status" in request.model_fields_set:
            shopping_list.status = request.status
        shopping_list = self.repository.update(shopping_list)
        return self._to_schema(shopping_list)

    def delete_shopping_list(self, user_id: int, shopping_list_id: int) -> None:
        shopping_list = self._get_user_shopping_list(user_id, shopping_list_id)
        self.repository.delete_linked_planned_items(
            user_id=user_id, shopping_list_id=shopping_list.id
        )
        self.repository.delete(shopping_list)

    def add_shopping_item(
        self,
        user_id: int,
        shopping_list_id: int,
        title: str,
        planned_for: date,
        notes: str | None = None,
        priority: Priority = Priority.normal,
        tags: list[str] | None = None,
    ) -> dict:
        shopping_list = self._get_user_shopping_list(user_id, shopping_list_id)
        item = self.today_service.create_planned_item(
            user_id=user_id,
            request=PlannedItemCreateRequest(
                title=title,
                planned_for=planned_for,
                notes=notes,
                module_key="shopping_list",
                linked_source="shopping_list",
                linked_ref=str(shopping_list.id),
                priority=priority,
                tags=tags or [],
            ),
        )
        return item.model_dump(mode="json")

    def check_off_shopping_item(
        self, user_id: int, shopping_list_id: int, planned_item_id: int
    ) -> dict:
        shopping_list = self._get_user_shopping_list(user_id, shopping_list_id)
        existing = self.today_service.repository.get_planned_item_for_user(
            user_id=user_id, planned_item_id=planned_item_id
        )
        if (
            existing is None
            or existing.module_key != "shopping_list"
            or existing.linked_ref != str(shopping_list.id)
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Shopping item not found"
            )
        item = self.today_service.update_planned_item(
            user_id=user_id,
            planned_item_id=planned_item_id,
            request=PlannedItemUpdateRequest(
                title=existing.title,
                planned_for=existing.planned_for,
                time_of_day=existing.time_of_day,
                duration_minutes=existing.duration_minutes,
                is_done=True,
                notes=existing.notes,
                module_key=cast(PlannedItemModuleKey | None, existing.module_key),
                recurrence_hint=existing.recurrence_hint,
                rrule=existing.rrule,
                linked_source=existing.linked_source,
                linked_ref=existing.linked_ref,
                priority=existing.priority,
                tags=existing.tags or [],
            ),
        )
        return item.model_dump(mode="json")

    def _get_user_shopping_list(
        self, user_id: int, shopping_list_id: int
    ) -> ShoppingList:
        shopping_list = self.repository.get_by_id(
            user_id=user_id, shopping_list_id=shopping_list_id
        )
        if shopping_list is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list not found"
            )
        return shopping_list

    @staticmethod
    def _to_schema(shopping_list: ShoppingList) -> ShoppingListResponse:
        return ShoppingListResponse(
            id=shopping_list.id,
            user_id=shopping_list.user_id,
            name=shopping_list.name,
            store=shopping_list.store,
            notes=shopping_list.notes,
            status=cast(ShoppingListStatus, shopping_list.status),
            created_at=shopping_list.created_at,
        )
