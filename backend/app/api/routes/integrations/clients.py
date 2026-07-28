from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

import jwt
from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.integration_auth import (
    get_integration_client_by_token_hash,
    hash_integration_key,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.integration_client import IntegrationClient
from app.models.user import User
from app.schemas.integrations import (
    IntegrationClientCreateRequest,
    IntegrationClientCreateResponse,
    IntegrationClientResponse,
    IntegrationClientTokenResponse,
)

router = APIRouter(prefix="/integrations/clients", tags=["integrations"])
LEGACY_HOME_ASSISTANT_CLIENT_ID = "home-assistant"
PEBBLE_PAIR_CLIENT_NAME = "Pebble watch"
PEBBLE_PAIR_SCOPES = ["pebble:read", "pebble:write"]
TOKEN_EXPIRES_IN_SECONDS = 300
_INTEGRATION_JWT_ISSUER = "daynest-integration"


def _create_integration_token(client: IntegrationClient) -> str:
    now = datetime.now(UTC)
    payload = {
        "iss": _INTEGRATION_JWT_ISSUER,
        "sub": str(client.id),
        "iat": now,
        "exp": now + timedelta(seconds=TOKEN_EXPIRES_IN_SECONDS),
    }
    return jwt.encode(payload, settings.resolved_integration_key_hash_secret, algorithm="HS256")


def _integration_client_id(client: IntegrationClient) -> str:
    return str(client.id)


def _valid_client_ids(client: IntegrationClient) -> set[str]:
    return {_integration_client_id(client), LEGACY_HOME_ASSISTANT_CLIENT_ID}


def _token_url(request: Request) -> str:
    return str(request.url_for("exchange_integration_client_token"))


def _create_response(
    request: Request,
    client: IntegrationClient,
    raw_key: str,
) -> IntegrationClientCreateResponse:
    return IntegrationClientCreateResponse(
        id=client.id,
        name=client.name,
        rate_limit_per_minute=client.rate_limit_per_minute,
        scopes=client.scopes,
        api_key=raw_key,
        client_id=_integration_client_id(client),
        client_secret=raw_key,
        token_url=_token_url(request),
    )


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
            rate_limit_per_minute=client.rate_limit_per_minute,
            scopes=client.scopes,
            is_active=client.is_active,
        )
        for client in clients
    ]


@router.post("", response_model=IntegrationClientCreateResponse)
def create_integration_client(
    request: Request,
    response: Response,
    payload: IntegrationClientCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationClientCreateResponse:
    response.headers["Cache-Control"] = "no-store"
    raw_key = f"daynest_{token_urlsafe(30)}"
    client = IntegrationClient(
        user_id=current_user.id,
        name=payload.name,
        key_hash=hash_integration_key(raw_key),
        rate_limit_per_minute=payload.rate_limit_per_minute,
        scopes=list(dict.fromkeys(payload.scopes)),
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return _create_response(request, client, raw_key)


@router.post("/pebble", response_model=IntegrationClientCreateResponse)
def pair_pebble_client(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationClientCreateResponse:
    """Create or rotate the user's narrowly scoped Pebble integration client."""
    response.headers["Cache-Control"] = "no-store"
    raw_key = f"daynest_{token_urlsafe(30)}"
    client = db.scalar(
        select(IntegrationClient).where(
            IntegrationClient.user_id == current_user.id,
            IntegrationClient.name == PEBBLE_PAIR_CLIENT_NAME,
        )
    )
    if client is None:
        client = IntegrationClient(
            user_id=current_user.id,
            name=PEBBLE_PAIR_CLIENT_NAME,
            key_hash=hash_integration_key(raw_key),
            rate_limit_per_minute=120,
            scopes=PEBBLE_PAIR_SCOPES,
        )
        db.add(client)
    else:
        client.key_hash = hash_integration_key(raw_key)
        client.scopes = PEBBLE_PAIR_SCOPES
        client.is_active = True
    db.commit()
    db.refresh(client)
    return _create_response(request, client, raw_key)


@router.post("/{client_id}/rotate", response_model=IntegrationClientCreateResponse)
def rotate_integration_client(
    client_id: int,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationClientCreateResponse:
    response.headers["Cache-Control"] = "no-store"
    client = db.scalar(
        select(IntegrationClient).where(
            IntegrationClient.id == client_id,
            IntegrationClient.user_id == current_user.id,
        )
    )
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration client not found")
    raw_key = f"daynest_{token_urlsafe(30)}"
    client.key_hash = hash_integration_key(raw_key)
    db.commit()
    db.refresh(client)
    return _create_response(request, client, raw_key)


@router.post("/token", response_model=IntegrationClientTokenResponse, name="exchange_integration_client_token")
def exchange_integration_client_token(
    response: Response,
    grant_type: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(...),
    db: Session = Depends(get_db),
) -> IntegrationClientTokenResponse:
    response.headers["Cache-Control"] = "no-store"
    if grant_type != "client_credentials":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported grant_type; expected client_credentials",
        )
    if not client_id.strip() or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OAuth client credentials",
        )

    client = get_integration_client_by_token_hash(db, hash_integration_key(client_secret))
    if client is None or not client.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OAuth client credentials",
        )
    if client_id.strip() not in _valid_client_ids(client):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OAuth client credentials",
        )

    return IntegrationClientTokenResponse(
        access_token=_create_integration_token(client),
        expires_in=TOKEN_EXPIRES_IN_SECONDS,
    )


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_integration_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    client = db.scalar(
        select(IntegrationClient).where(
            IntegrationClient.id == client_id,
            IntegrationClient.user_id == current_user.id,
        )
    )
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration client not found")
    db.delete(client)
    db.commit()
