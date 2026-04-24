from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


@lru_cache
def _read_secret_file(path: str | None) -> str | None:
    if not path:
        return None
    secret_path = Path(path)
    if not secret_path.exists():
        return None
    return secret_path.read_text(encoding="utf-8").strip()


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Daynest API"
    version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    environment: str = "dev"

    database_url: str | None = None
    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "daynest"
    db_user: str = "daynest"
    db_password: str | None = None
    db_password_file: str | None = None

    jwt_secret_key: str | None = None
    jwt_secret_file: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_allow_origins: list[str] = Field(default_factory=list)
    trusted_hosts: list[str] = Field(default_factory=lambda: ["localhost", "127.0.0.1", "testserver"])

    password_hash_iterations: int = 390000

    log_level: str = "INFO"
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.0

    @field_validator("cors_allow_origins", "trusted_hosts", mode="before")
    @classmethod
    def _split_csv_lists(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @computed_field
    @property
    def resolved_db_password(self) -> str | None:
        return self.db_password or _read_secret_file(self.db_password_file)

    @computed_field
    @property
    def resolved_jwt_secret_key(self) -> str:
        secret = self.jwt_secret_key or _read_secret_file(self.jwt_secret_file)
        if secret:
            return secret
        if self.environment == "dev":
            return "local-dev-secret"
        raise ValueError("JWT secret key must be provided via JWT_SECRET_KEY or JWT_SECRET_FILE")

    @computed_field
    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        password = self.resolved_db_password
        if password:
            return f"postgresql+psycopg://{self.db_user}:{quote_plus(password)}@{self.db_host}:{self.db_port}/{self.db_name}"
        return f"postgresql+psycopg://{self.db_user}@{self.db_host}:{self.db_port}/{self.db_name}"


@lru_cache
def get_settings() -> AppSettings:
    return AppSettings()


settings = get_settings()
