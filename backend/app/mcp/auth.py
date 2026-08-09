"""FastMCP authentication adapters for managed Daynest clients."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import HTTPException
from fastmcp.server.auth import AccessToken, TokenVerifier
from sqlalchemy.orm import Session

from app.api.dependencies.integration_auth import (
    enforce_integration_rate_limit,
    get_integration_client_by_raw_key,
    record_integration_client_use,
)


class IntegrationKeyTokenVerifier(TokenVerifier):
    def __init__(
        self,
        session_factory: Callable[[], Session],
        *,
        resource_server_url: str | None = None,
    ) -> None:
        super().__init__(resource_base_url=resource_server_url)
        self.session_factory = session_factory

    async def verify_token(self, token: str) -> AccessToken | None:
        session = self.session_factory()
        try:
            client = get_integration_client_by_raw_key(session, token)
            if (
                client is None
                or not client.is_active
                or client.revoked_at is not None
                or client.user is None
                or not client.user.is_active
            ):
                return None
            try:
                enforce_integration_rate_limit(session, client)
                record_integration_client_use(session, client)
            except HTTPException:
                return None
            return AccessToken(
                token=token,
                client_id=str(client.id),
                scopes=[],
                claims={
                    "auth_source": "integration",
                    "integration_client_id": client.id,
                },
            )
        finally:
            session.close()
