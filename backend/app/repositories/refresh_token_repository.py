from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.refresh_token import RefreshToken


class RefreshTokenRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, user_id: int, jti: str, expires_at: datetime) -> RefreshToken:
        token = RefreshToken(user_id=user_id, jti=jti, expires_at=expires_at)
        self.db.add(token)
        self.db.commit()
        self.db.refresh(token)
        return token

    def get_by_jti(self, jti: str) -> RefreshToken | None:
        return self.db.scalar(select(RefreshToken).where(RefreshToken.jti == jti))

    def revoke(self, token: RefreshToken) -> None:
        token.revoked_at = datetime.now(timezone.utc)
        self.db.commit()

    def consume_if_unrevoked(self, jti: str) -> RefreshToken | None:
        """Atomically revoke token only if currently unrevoked. Returns token on success, None if already revoked or not found."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.jti == jti)
            .where(RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
            .returning(RefreshToken)
        )
        result = self.db.execute(stmt)
        token = result.scalar_one_or_none()
        self.db.commit()
        return token

    def revoke_all_for_user(self, user_id: int) -> None:
        now = datetime.now(timezone.utc)
        self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .where(RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        self.db.commit()
