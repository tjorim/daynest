from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    app_name: str = "Daynest API"
    version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./daynest.db"
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    password_hash_iterations: int = 390000

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = AppSettings()
