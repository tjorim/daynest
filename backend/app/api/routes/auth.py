from datetime import timedelta, timezone
from datetime import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.config import settings
from app.core.password import hash_password, verify_password
from app.core.tokens import create_access_token, create_refresh_token, decode_token
from app.db.session import get_db
from app.models.user import User
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenPairResponse, UserMeResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_token_pair(user: User, db: Session) -> TokenPairResponse:
    """Create a new access/refresh token pair and persist the refresh token jti."""
    refresh_token_str, jti = create_refresh_token(user.id, user.email)
    expires_at = dt.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    RefreshTokenRepository(db).create(user_id=user.id, jti=jti, expires_at=expires_at)
    return TokenPairResponse(
        access_token=create_access_token(user.id, user.email),
        refresh_token=refresh_token_str,
    )


@router.post("/register", response_model=TokenPairResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenPairResponse:
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from exc
    db.refresh(user)
    return _issue_token_pair(user, db)


@router.post("/login", response_model=TokenPairResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenPairResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account inactive")
    return _issue_token_pair(user, db)


@router.post("/refresh", response_model=TokenPairResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenPairResponse:
    try:
        claims = decode_token(payload.refresh_token)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if claims.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = claims.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    jti = claims.get("jti")
    if jti is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    repo = RefreshTokenRepository(db)
    stored = repo.get_by_jti(jti)

    if stored is None:
        # Token was never issued by this server or has been purged.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if stored.revoked_at is not None:
        # Reuse detected — revoke the entire token family and force re-login.
        repo.revoke_all_for_user(user.id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reuse detected")

    # Rotate: invalidate the current token, issue a fresh pair.
    repo.revoke(stored)
    return _issue_token_pair(user, db)


@router.get("/me", response_model=UserMeResponse)
def me(current_user: User = Depends(get_current_user)) -> UserMeResponse:
    return UserMeResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
    )
