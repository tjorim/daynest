from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import HouseholdMemberRole
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.user import User


class HouseholdRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_household(self, name: str, owner: User) -> Household:
        household = Household(name=name)
        self.db.add(household)
        self.db.flush()
        membership = HouseholdMember(
            household_id=household.id,
            user_id=owner.id,
            role=HouseholdMemberRole.owner,
        )
        self.db.add(membership)
        self.db.commit()
        self.db.refresh(household)
        return household

    def get_household(self, household_id: int) -> Household | None:
        return self.db.scalar(select(Household).where(Household.id == household_id))

    def update_household_name(self, household: Household, name: str) -> Household:
        household.name = name
        self.db.commit()
        self.db.refresh(household)
        return household

    def delete_household(self, household: Household) -> None:
        self.db.delete(household)
        self.db.commit()

    def get_membership(self, household_id: int, user_id: int) -> HouseholdMember | None:
        return self.db.scalar(
            select(HouseholdMember)
            .where(HouseholdMember.household_id == household_id)
            .where(HouseholdMember.user_id == user_id)
        )

    def list_user_households(self, user_id: int) -> list[Household]:
        stmt = (
            select(Household)
            .join(HouseholdMember, Household.id == HouseholdMember.household_id)
            .where(HouseholdMember.user_id == user_id)
            .order_by(Household.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_user_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def add_member(self, household: Household, user: User, role: HouseholdMemberRole = HouseholdMemberRole.member) -> HouseholdMember:
        membership = HouseholdMember(
            household_id=household.id,
            user_id=user.id,
            role=role,
        )
        self.db.add(membership)
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def remove_member(self, membership: HouseholdMember) -> None:
        self.db.delete(membership)
        self.db.commit()

    def list_members(self, household_id: int) -> list[HouseholdMember]:
        stmt = (
            select(HouseholdMember)
            .where(HouseholdMember.household_id == household_id)
            .order_by(HouseholdMember.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_user_household_ids(self, user_id: int) -> list[int]:
        rows = self.db.execute(
            select(HouseholdMember.household_id).where(HouseholdMember.user_id == user_id)
        ).all()
        return [row[0] for row in rows]
