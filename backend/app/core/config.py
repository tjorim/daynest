from pydantic import BaseModel


class AppSettings(BaseModel):
    app_name: str = "Daynest API"
    version: str = "0.1.0"
    api_prefix: str = "/api/v1"


settings = AppSettings()
