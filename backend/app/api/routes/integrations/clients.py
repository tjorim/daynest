from secrets import token_urlsafe

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.integration_auth import hash_integration_key
from app.db.session import get_db
from app.models.integration_client import IntegrationClient
from app.models.user import User
from app.schemas.integrations import (
    IntegrationClientCreateRequest,
    IntegrationClientCreateResponse,
    IntegrationClientResponse,
)

router = APIRouter(prefix="/integrations/clients", tags=["integrations"])


@router.get("", response_model=list[IntegrationClientResponse])
def list_integration_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[IntegrationClientResponse]:
    stmt = select(IntegrationClient).where(IntegrationClient.user_id == current_user.id).order_by(IntegrationClient.id.asc())
    clients = list(db.scalars(stmt).all())
    return [
        IntegrationClientResponse(
            id=client.id,
            name=client.name,
            scopes=[scope for scope in client.scopes_csv.split(",") if scope],
            rate_limit_per_minute=client.rate_limit_per_minute,
            is_active=client.is_active,
        )
        for client in clients
    ]


@router.post("", response_model=IntegrationClientCreateResponse)
def create_integration_client(
    payload: IntegrationClientCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationClientCreateResponse:
    scopes = sorted({scope.strip() for scope in payload.scopes if scope.strip()})
    raw_key = f"daynest_{token_urlsafe(30)}"
    client = IntegrationClient(
        user_id=current_user.id,
        name=payload.name,
        key_hash=hash_integration_key(raw_key),
        scopes_csv=",".join(scopes),
        rate_limit_per_minute=payload.rate_limit_per_minute,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return IntegrationClientCreateResponse(
        id=client.id,
        name=client.name,
        scopes=scopes,
        rate_limit_per_minute=client.rate_limit_per_minute,
        api_key=raw_key,
    )
