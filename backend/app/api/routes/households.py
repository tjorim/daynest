from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.enums import HouseholdMemberRole
from app.db.session import get_db
from app.models.user import User
from app.repositories.household_repository import HouseholdRepository
from app.schemas.households import (
    HouseholdCreateRequest,
    HouseholdMemberResponse,
    HouseholdResponse,
    HouseholdUpdateRequest,
    InviteRequest,
)

router = APIRouter(tags=["households"])


def _household_to_response(household, members) -> HouseholdResponse:
    return HouseholdResponse(
        id=household.id,
        name=household.name,
        created_at=household.created_at,
        members=[
            HouseholdMemberResponse(
                user_id=m.user.id,
                email=m.user.email,
                full_name=m.user.full_name,
                role=m.role,
                joined_at=m.created_at,
            )
            for m in members
        ],
    )


@router.post("", response_model=HouseholdResponse, status_code=201)
def create_household(
    request: HouseholdCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HouseholdResponse:
    repo = HouseholdRepository(db)
    household = repo.create_household(name=request.name, owner=current_user)
    members = repo.list_members(household.id)
    return _household_to_response(household, members)


@router.get("", response_model=list[HouseholdResponse])
def list_households(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[HouseholdResponse]:
    repo = HouseholdRepository(db)
    households = repo.list_user_households(current_user.id)
    return [_household_to_response(household, household.members) for household in households]


@router.get("/{household_id}", response_model=HouseholdResponse)
def get_household(
    household_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HouseholdResponse:
    repo = HouseholdRepository(db)
    household = repo.get_household(household_id)
    if household is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
    membership = repo.get_membership(household_id=household_id, user_id=current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this household")
    members = repo.list_members(household_id)
    return _household_to_response(household, members)


@router.put("/{household_id}", response_model=HouseholdResponse)
def update_household(
    household_id: int,
    request: HouseholdUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HouseholdResponse:
    repo = HouseholdRepository(db)
    household = repo.get_household(household_id)
    if household is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
    membership = repo.get_membership(household_id=household_id, user_id=current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this household")
    if membership.role != HouseholdMemberRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the household owner can update household settings")
    household = repo.update_household_name(household, request.name)
    members = repo.list_members(household_id)
    return _household_to_response(household, members)


@router.post("/{household_id}/invite", response_model=HouseholdMemberResponse, status_code=201)
def invite_member(
    household_id: int,
    request: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HouseholdMemberResponse:
    repo = HouseholdRepository(db)
    household = repo.get_household(household_id)
    if household is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
    membership = repo.get_membership(household_id=household_id, user_id=current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this household")
    if membership.role != HouseholdMemberRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the household owner can invite members")

    invitee = repo.get_user_by_email(request.email)
    if invitee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User with this email not found")

    existing = repo.get_membership(household_id=household_id, user_id=invitee.id)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member of this household")

    new_membership = repo.add_member(household, invitee)
    return HouseholdMemberResponse(
        user_id=invitee.id,
        email=invitee.email,
        full_name=invitee.full_name,
        role=new_membership.role,
        joined_at=new_membership.created_at,
    )


@router.delete("/{household_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    household_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    repo = HouseholdRepository(db)
    household = repo.get_household(household_id)
    if household is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")

    current_membership = repo.get_membership(household_id=household_id, user_id=current_user.id)
    if current_membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this household")

    target_membership = repo.get_membership(household_id=household_id, user_id=user_id)
    if target_membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    # Owner can remove anyone; non-owners can only remove themselves
    if current_user.id != user_id and current_membership.role != HouseholdMemberRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the household owner can remove other members")

    # Prevent removing the last owner
    if target_membership.role == HouseholdMemberRole.owner:
        members = repo.list_members(household_id)
        owner_count = sum(1 for m in members if m.role == HouseholdMemberRole.owner)
        if owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot remove the last owner of a household",
            )

    repo.remove_member(target_membership)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{household_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_household(
    household_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    repo = HouseholdRepository(db)
    household = repo.get_household(household_id)
    if household is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household not found")
    membership = repo.get_membership(household_id=household_id, user_id=current_user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this household")
    if membership.role != HouseholdMemberRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the household owner can delete the household")
    repo.delete_household(household)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
