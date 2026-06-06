from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.meal_plan import MealPlan, MealSlot
from app.schemas.meal_plan import MEAL_SLOT_TYPES


class MealPlanRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_user(self, user_id: int) -> list[MealPlan]:
        stmt = (
            select(MealPlan)
            .where(MealPlan.user_id == user_id)
            .order_by(MealPlan.week_start.desc(), MealPlan.created_at.desc(), MealPlan.id.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, user_id: int, meal_plan_id: int, *, include_slots: bool = False) -> MealPlan | None:
        stmt = select(MealPlan).where(MealPlan.user_id == user_id, MealPlan.id == meal_plan_id)
        if include_slots:
            stmt = stmt.options(selectinload(MealPlan.slots))
        return self.db.scalar(stmt)

    def create(self, meal_plan: MealPlan) -> MealPlan:
        self.db.add(meal_plan)
        self.db.flush()
        self._ensure_week_slots(meal_plan)
        self.db.commit()
        self.db.refresh(meal_plan)
        return meal_plan

    def update(self, meal_plan: MealPlan) -> MealPlan:
        self._ensure_week_slots(meal_plan)
        self.db.commit()
        self.db.refresh(meal_plan)
        return meal_plan

    def delete(self, meal_plan: MealPlan) -> None:
        self.db.delete(meal_plan)
        self.db.commit()

    def get_slot(self, user_id: int, meal_plan_id: int, slot_id: int) -> MealSlot | None:
        stmt = (
            select(MealSlot)
            .join(MealPlan)
            .where(MealPlan.user_id == user_id, MealSlot.meal_plan_id == meal_plan_id, MealSlot.id == slot_id)
        )
        return self.db.scalar(stmt)

    def save_slot(self, slot: MealSlot) -> MealSlot:
        self.db.commit()
        self.db.refresh(slot)
        return slot

    def _ensure_week_slots(self, meal_plan: MealPlan) -> None:
        self.db.flush()
        existing = {(slot.slot_date, slot.slot_type) for slot in meal_plan.slots}
        for offset in range(7):
            slot_date = meal_plan.week_start + timedelta(days=offset)
            for slot_type in MEAL_SLOT_TYPES:
                if (slot_date, slot_type) not in existing:
                    self.db.add(MealSlot(meal_plan_id=meal_plan.id, slot_date=slot_date, slot_type=slot_type, title=""))
