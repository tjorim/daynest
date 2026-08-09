from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.planned_item import PlannedItem
from app.models.shopping_list import ShoppingList
from app.schemas.shopping_list import ShoppingListStatus
from app.services.audit_service import AuditActor, write_audit_entry


class ShoppingListRepository:
    def __init__(self, db: Session):
        self.db = db

    def record_audit(
        self,
        actor: AuditActor | None,
        action: str,
        resource_type: str,
        resource_id: object,
        *,
        details: dict | None = None,
    ) -> None:
        """Stage an audit entry (no commit) if ``actor`` is provided — see
        TodayRepository.record_audit for the same pattern and rationale."""

        if actor is None:
            return
        write_audit_entry(
            self.db,
            actor=actor,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            details=details,
        )

    def list_by_user(
        self, user_id: int, status: ShoppingListStatus | None = "active", *, limit: int | None = None
    ) -> list[ShoppingList]:
        stmt = select(ShoppingList).where(ShoppingList.user_id == user_id)
        if status is not None:
            stmt = stmt.where(ShoppingList.status == status)
        stmt = stmt.order_by(ShoppingList.created_at.desc(), ShoppingList.id.desc())
        if limit is not None:
            stmt = stmt.limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, user_id: int, shopping_list_id: int) -> ShoppingList | None:
        stmt = (
            select(ShoppingList)
            .where(ShoppingList.user_id == user_id)
            .where(ShoppingList.id == shopping_list_id)
        )
        return self.db.scalar(stmt)

    def create(self, shopping_list: ShoppingList, *, actor: AuditActor | None = None) -> ShoppingList:
        self.db.add(shopping_list)
        self.db.flush()
        self.record_audit(actor, "shopping_list.create", "shopping_list", shopping_list.id, details={"name": shopping_list.name})
        self.db.commit()
        self.db.refresh(shopping_list)
        return shopping_list

    def update(self, shopping_list: ShoppingList, *, actor: AuditActor | None = None) -> ShoppingList:
        self.record_audit(actor, "shopping_list.update", "shopping_list", shopping_list.id, details={"name": shopping_list.name})
        self.db.commit()
        self.db.refresh(shopping_list)
        return shopping_list

    def delete(self, shopping_list: ShoppingList, *, actor: AuditActor | None = None) -> None:
        shopping_list_id = shopping_list.id
        self.db.delete(shopping_list)
        self.record_audit(actor, "shopping_list.delete", "shopping_list", shopping_list_id)
        self.db.commit()

    def count_linked_planned_items(self, user_id: int, shopping_list_id: int) -> int:
        from sqlalchemy import func
        return self.db.scalar(
            select(func.count()).select_from(PlannedItem).where(
                PlannedItem.user_id == user_id,
                PlannedItem.module_key == "shopping_list",
                PlannedItem.linked_ref == str(shopping_list_id),
            )
        ) or 0

    def delete_linked_planned_items(self, user_id: int, shopping_list_id: int) -> None:
        self.db.execute(
            delete(PlannedItem).where(
                PlannedItem.user_id == user_id,
                PlannedItem.module_key == "shopping_list",
                PlannedItem.linked_ref == str(shopping_list_id),
            )
        )

    def save(self) -> None:
        self.db.commit()
