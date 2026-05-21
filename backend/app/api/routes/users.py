from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.users import UserSettingsPatchRequest, UserSettingsResponse
from app.services.export_import_service import build_user_export, import_user_export, user_export_to_csv

router = APIRouter(prefix="/users", tags=["users"])


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
