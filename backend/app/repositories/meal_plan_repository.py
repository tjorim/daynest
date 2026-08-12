from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.meal_plan import MealPlan, MealSlot
from app.schemas.meal_plan import MEAL_SLOT_TYPES
from app.services.audit_service import AuditActor, write_audit_entry


class MealPlanRepository:
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

    def list_by_user(self, user_id: int) -> list[MealPlan]:
        stmt = (
            select(MealPlan)
            .where(MealPlan.user_id == user_id)
            .order_by(
                MealPlan.week_start.desc(),
                MealPlan.created_at.desc(),
                MealPlan.id.desc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, user_id: int, meal_plan_id: int, *, include_slots: bool = False) -> MealPlan | None:
        stmt = select(MealPlan).where(MealPlan.user_id == user_id, MealPlan.id == meal_plan_id)
        if include_slots:
            stmt = stmt.options(selectinload(MealPlan.slots))
        return self.db.scalar(stmt)

    def create(self, meal_plan: MealPlan, *, actor: AuditActor | None = None) -> MealPlan:
        self.db.add(meal_plan)
        self.db.flush()
        self._ensure_week_slots(meal_plan)
        self.record_audit(
            actor,
            "meal_plan.create",
            "meal_plan",
            meal_plan.id,
            details={"name": meal_plan.name},
        )
        self.db.commit()
        self.db.refresh(meal_plan)
        return meal_plan

    def update(self, meal_plan: MealPlan, *, actor: AuditActor | None = None) -> MealPlan:
        self._ensure_week_slots(meal_plan)
        self.record_audit(
            actor,
            "meal_plan.update",
            "meal_plan",
            meal_plan.id,
            details={"name": meal_plan.name},
        )
        self.db.commit()
        self.db.refresh(meal_plan)
        return meal_plan

    def delete(self, meal_plan: MealPlan, *, actor: AuditActor | None = None) -> None:
        plan_id = meal_plan.id
        self.db.delete(meal_plan)
        self.record_audit(actor, "meal_plan.delete", "meal_plan", plan_id)
        self.db.commit()

    def get_slot(self, user_id: int, meal_plan_id: int, slot_id: int) -> MealSlot | None:
        stmt = (
            select(MealSlot)
            .join(MealPlan)
            .where(
                MealPlan.user_id == user_id,
                MealSlot.meal_plan_id == meal_plan_id,
                MealSlot.id == slot_id,
            )
        )
        return self.db.scalar(stmt)

    def save_slot(self, slot: MealSlot, *, actor: AuditActor | None = None) -> MealSlot:
        self.record_audit(
            actor,
            "meal_slot.update",
            "meal_slot",
            slot.id,
            details={"meal_plan_id": slot.meal_plan_id},
        )
        self.db.commit()
        self.db.refresh(slot)
        return slot

    def _ensure_week_slots(self, meal_plan: MealPlan) -> None:
        self.db.flush()
        valid_dates = {meal_plan.week_start + timedelta(days=offset) for offset in range(7)}
        # Reassigning slots drops out-of-range entries; delete-orphan cascade removes them from DB
        meal_plan.slots = [slot for slot in meal_plan.slots if slot.slot_date in valid_dates]
        existing = {(slot.slot_date, slot.slot_type) for slot in meal_plan.slots}
        for slot_date in sorted(valid_dates):
            for slot_type in MEAL_SLOT_TYPES:
                if (slot_date, slot_type) not in existing:
                    meal_plan.slots.append(MealSlot(slot_date=slot_date, slot_type=slot_type, title=""))
