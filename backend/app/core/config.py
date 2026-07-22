from functools import lru_cache
from pathlib import Path
from typing import Annotated
from urllib.parse import quote_plus

from pydantic import Field, PrivateAttr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _read_secret_file(path: str | None) -> str | None:
    if not path:
        return None
    secret_path = Path(path)
    if not secret_path.exists():
        raise ValueError(f"Secret file configured but not found: {path}")
    try:
        value = secret_path.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise ValueError(f"Secret file configured but could not be read: {path}") from exc
    if not value:
        raise ValueError(f"Secret file configured but empty: {path}")
    return value


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    _cached_db_password: str | None = PrivateAttr(default=None)
    _cached_integration_key_hash_secret: str | None = PrivateAttr(default=None)

    app_name: str = "Daynest API"
    version: str = "0.1.0"
    api_prefix: str = "/api"
    environment: str = "dev"

    database_url: str | None = None
    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "daynest"
    db_user: str = "daynest"
    db_password: str | None = None
    db_password_file: str | None = None
    db_connect_timeout_seconds: int = 5

    oidc_issuer_url: str | None = None
    oidc_audience: str | None = None
    oidc_jwks_uri: str | None = None
    oidc_algorithms: str = "RS256"

    upcoming_horizon_days: int = 7
    medication_missed_grace_minutes: int = 30

    cors_allow_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    trusted_hosts: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["localhost", "127.0.0.1"])

    metrics_secret: str | None = None
    integration_key_hash_secret: str | None = None
    integration_key_hash_secret_file: str | None = None

    password_hash_iterations: int = 600000

    feature_home_assistant: bool = True
    feature_mcp: bool = True
    feature_export_import: bool = False

    # Per-client-IP rate limiting (slowapi) on the general REST API. Health
    # probes are exempt. rate_limit_default uses the flask-limiter/slowapi
    # rate string format, e.g. "200/minute", "10/second", "5000/hour".
    rate_limit_enabled: bool = True
    rate_limit_default: str = "200/minute"

    log_level: str = "INFO"
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.0

    fcm_project_id: str | None = None
    fcm_service_account_file: str | None = None
    vapid_private_key: str | None = None
    vapid_public_key: str | None = None
    vapid_claims_email: str | None = None

    @field_validator("cors_allow_origins", "trusted_hosts", mode="before")
    @classmethod
    def _split_csv_lists(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def _validate_secrets(self) -> "AppSettings":
        self._cached_db_password = self.db_password or _read_secret_file(self.db_password_file)
        self._cached_integration_key_hash_secret = (
            self.integration_key_hash_secret or _read_secret_file(self.integration_key_hash_secret_file)
        )
        if not self.database_url and not self._cached_db_password and self.environment != "dev":
            raise ValueError("Database password must be provided via DB_PASSWORD or DB_PASSWORD_FILE in non-dev environments")
        if not self.oidc_issuer_url and self.environment != "dev":
            raise ValueError("OIDC_ISSUER_URL must be set in non-dev environments")
        if not self.oidc_audience and self.oidc_algorithms != "none" and self.environment != "dev":
            raise ValueError("OIDC_AUDIENCE must be set in non-dev environments when using token verification")
        if not self._cached_integration_key_hash_secret and self.environment != "dev":
            raise ValueError(
                "INTEGRATION_KEY_HASH_SECRET or INTEGRATION_KEY_HASH_SECRET_FILE must be set in non-dev environments"
            )
        if self.trusted_hosts == ["localhost", "127.0.0.1"] and self.environment != "dev":
            raise ValueError("TRUSTED_HOSTS must be set in non-dev environments")
        return self

    @property
    def resolved_integration_key_hash_secret(self) -> str:
        return self._cached_integration_key_hash_secret or "daynest-dev-integration-key-hash-secret"

    @property
    def resolved_db_password(self) -> str | None:
        return self._cached_db_password

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        if self.environment == "dev":
            dev_db_path = Path(__file__).resolve().parents[2] / "dev.db"
            return f"sqlite:///{dev_db_path}"
        password = self.resolved_db_password
        if password:
            return f"postgresql+psycopg://{quote_plus(self.db_user)}:{quote_plus(password)}@{self.db_host}:{self.db_port}/{self.db_name}"
        return f"postgresql+psycopg://{quote_plus(self.db_user)}@{self.db_host}:{self.db_port}/{self.db_name}"


@lru_cache
def get_settings() -> AppSettings:
    return AppSettings()


settings = get_settings()
