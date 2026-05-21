from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.push import PushSubscribeRequest, PushUnsubscribeRequest

router = APIRouter(tags=["push"])


@router.post("/push/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def subscribe_push(
    request: PushSubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else postgresql_insert
    statement = insert(PushSubscription).values(
        user_id=current_user.id,
        platform=request.platform,
        endpoint=request.endpoint,
        p256dh=request.p256dh,
        auth=request.auth,
        is_active=True,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[PushSubscription.endpoint],
        set_={
            "platform": statement.excluded.platform,
            "p256dh": statement.excluded.p256dh,
            "auth": statement.excluded.auth,
            "is_active": True,
        },
        where=PushSubscription.user_id == current_user.id,
    )
    db.execute(statement)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/push/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe_push(
    request: PushUnsubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    existing = db.scalar(
        select(PushSubscription)
        .where(PushSubscription.endpoint == request.endpoint)
        .where(PushSubscription.user_id == current_user.id)
    )
    if existing is not None:
        existing.is_active = False
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
