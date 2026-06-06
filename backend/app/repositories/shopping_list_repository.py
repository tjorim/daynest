from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.planned_item import PlannedItem
from app.models.shopping_list import ShoppingList
from app.schemas.shopping_list import ShoppingListStatus


class ShoppingListRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_user(
        self, user_id: int, status: ShoppingListStatus | None = "active"
    ) -> list[ShoppingList]:
        stmt = select(ShoppingList).where(ShoppingList.user_id == user_id)
        if status is not None:
            stmt = stmt.where(ShoppingList.status == status)
        stmt = stmt.order_by(ShoppingList.created_at.desc(), ShoppingList.id.desc())
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, user_id: int, shopping_list_id: int) -> ShoppingList | None:
        stmt = (
            select(ShoppingList)
            .where(ShoppingList.user_id == user_id)
            .where(ShoppingList.id == shopping_list_id)
        )
        return self.db.scalar(stmt)

    def create(self, shopping_list: ShoppingList) -> ShoppingList:
        self.db.add(shopping_list)
        self.db.commit()
        self.db.refresh(shopping_list)
        return shopping_list

    def update(self, shopping_list: ShoppingList) -> ShoppingList:
        self.db.commit()
        self.db.refresh(shopping_list)
        return shopping_list

    def delete(self, shopping_list: ShoppingList) -> None:
        self.db.delete(shopping_list)
        self.db.commit()

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
