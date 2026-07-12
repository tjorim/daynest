from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, HttpUrl, field_validator


class UserMeResponse(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    is_active: bool
    timezone: str = "UTC"
    roles: list[str] = []


class UserUpdateRequest(BaseModel):
    timezone: str

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, KeyError):
            raise ValueError(f"Unknown timezone: {v!r}. Use an IANA timezone name such as 'Europe/Brussels'.")
        return v


class OidcDiscoveryConfig(BaseModel):
    issuer: HttpUrl
    authorization_url: HttpUrl
    token_url: HttpUrl
    end_session_endpoint: HttpUrl | None = None


class OAuthSessionClient(BaseModel):
    """A client entry within a Keycloak session."""

    clientId: str
    clientName: str | None = None
    userConsentRequired: bool = False
    inUse: bool = False
    offlineAccess: bool = False


class OAuthSessionResponse(BaseModel):
    """Active OAuth session returned by the Keycloak Account REST API."""

    id: str
    ip_address: str | None = None
    started: int | None = None
    last_access: int | None = None
    expires: int | None = None
    clients: list[OAuthSessionClient] = []
    is_current: bool = False
