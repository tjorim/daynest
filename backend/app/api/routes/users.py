from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.api.dependencies.auth import get_current_user
from app.core.enums import HouseholdMemberRole
from app.db.session import get_db
from app.models.chore_template import ChoreTemplate
from app.models.household_member import HouseholdMember
from app.models.user import User
from app.schemas.users import UserSettingsPatchRequest, UserSettingsResponse
from app.services.export_import_service import build_user_export, import_user_export, user_export_to_csv

router = APIRouter(prefix="/users", tags=["users"])


def _has_household_shared_chores(db: Session, user_id: int) -> bool:
    stmt = (
        select(ChoreTemplate.id)
        .join(HouseholdMember, HouseholdMember.household_id == ChoreTemplate.household_id)
        .where(
            ChoreTemplate.user_id == user_id,
            HouseholdMember.user_id != user_id,
        )
        .exists()
    )
    return db.scalar(select(stmt)) or False


def _is_sole_owner_of_shared_household(db: Session, user_id: int) -> bool:
    owner = aliased(HouseholdMember)
    other_member = aliased(HouseholdMember)
    other_owner = aliased(HouseholdMember)

    has_other_member = (
        select(other_member.id)
        .where(
            other_member.household_id == owner.household_id,
            other_member.user_id != user_id,
        )
        .exists()
    )
    has_other_owner = (
        select(other_owner.id)
        .where(
            other_owner.household_id == owner.household_id,
            other_owner.user_id != user_id,
            other_owner.role == HouseholdMemberRole.owner,
        )
        .exists()
    )
    stmt = (
        select(owner.id)
        .where(
            owner.user_id == user_id,
            owner.role == HouseholdMemberRole.owner,
            has_other_member,
            ~has_other_owner,
        )
        .exists()
    )
    return db.scalar(select(stmt)) or False


def _to_response(user: User) -> UserSettingsResponse:
    return UserSettingsResponse(
        timezone=user.timezone,
        default_snooze_days=user.default_snooze_days,
        medication_reminder_minutes=user.medication_reminder_minutes,
        quiet_hours_start=user.quiet_hours_start,
        quiet_hours_end=user.quiet_hours_end,
        push_overdue_chores_enabled=user.push_overdue_chores_enabled,
        push_medication_reminders_enabled=user.push_medication_reminders_enabled,
        push_missed_medications_enabled=user.push_missed_medications_enabled,
    )


@router.get("/me/settings", response_model=UserSettingsResponse)
def get_settings(current_user: User = Depends(get_current_user)) -> UserSettingsResponse:
    return _to_response(current_user)


@router.patch("/me/settings", response_model=UserSettingsResponse)
def update_settings(
    request: UserSettingsPatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserSettingsResponse:
    if request.timezone is not None:
        try:
            ZoneInfo(request.timezone)
        except ZoneInfoNotFoundError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid IANA timezone")
        current_user.timezone = request.timezone
    if request.default_snooze_days is not None:
        current_user.default_snooze_days = request.default_snooze_days
    if request.medication_reminder_minutes is not None:
        current_user.medication_reminder_minutes = request.medication_reminder_minutes
    if "quiet_hours_start" in request.model_fields_set:
        current_user.quiet_hours_start = request.quiet_hours_start
    if "quiet_hours_end" in request.model_fields_set:
        current_user.quiet_hours_end = request.quiet_hours_end
    if request.push_overdue_chores_enabled is not None:
        current_user.push_overdue_chores_enabled = request.push_overdue_chores_enabled
    if request.push_medication_reminders_enabled is not None:
        current_user.push_medication_reminders_enabled = request.push_medication_reminders_enabled
    if request.push_missed_medications_enabled is not None:
        current_user.push_missed_medications_enabled = request.push_missed_medications_enabled
    db.commit()
    db.refresh(current_user)
    return _to_response(current_user)


@router.get("/me/export", response_model=None)
def export_user_data(
    format: str = Query(default="json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any] | Response:
    payload = build_user_export(db, current_user)
    if format == "csv":
        return Response(
            content=user_export_to_csv(payload),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="daynest-export.csv"'},
        )
    return payload


@router.post("/me/import")
def import_user_data(
    payload: dict[str, Any] = Body(...),
    replace: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    counts = import_user_export(db, current_user, payload, replace=replace)
    return {"imported": counts}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_current_user(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    if _has_household_shared_chores(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Account deletion is blocked while you own household-shared chores. "
                "Delete or transfer those chores, or leave shared households before deleting your account."
            ),
        )

    if _is_sole_owner_of_shared_household(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Account deletion is blocked while you are the sole owner of a shared household. "
                "Transfer ownership, remove the other members, or delete the household before deleting your account."
            ),
        )

    db.delete(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
