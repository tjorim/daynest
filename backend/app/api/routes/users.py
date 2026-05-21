from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.users import UserSettingsPatchRequest, UserSettingsResponse

router = APIRouter(prefix="/users", tags=["users"])


def _to_response(user: User) -> UserSettingsResponse:
    return UserSettingsResponse(
        timezone=user.timezone,
        default_snooze_days=user.default_snooze_days,
        medication_reminder_minutes=user.medication_reminder_minutes,
        quiet_hours_start=user.quiet_hours_start,
        quiet_hours_end=user.quiet_hours_end,
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
    if request.quiet_hours_start is not None:
        current_user.quiet_hours_start = request.quiet_hours_start
    if request.quiet_hours_end is not None:
        current_user.quiet_hours_end = request.quiet_hours_end
    db.commit()
    db.refresh(current_user)
    return _to_response(current_user)
