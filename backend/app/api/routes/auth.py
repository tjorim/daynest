from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserMeResponse, UserUpdateRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_to_response(user: User, roles: list[str]) -> UserMeResponse:
    return UserMeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        timezone=user.timezone,
        roles=roles,
    )


@router.get("/me", response_model=UserMeResponse)
async def me(request: Request, current_user: User = Depends(get_current_user)) -> UserMeResponse:
    return _user_to_response(current_user, getattr(request.state, "roles", []))


@router.patch("/me", response_model=UserMeResponse)
async def update_me(
    request: Request,
    body: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserMeResponse:
    current_user.timezone = body.timezone
    db.commit()
    db.refresh(current_user)
    return _user_to_response(current_user, getattr(request.state, "roles", []))
