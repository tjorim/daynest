from pydantic import BaseModel, Field, model_validator

from app.core.enums import PushPlatform


class PushSubscribeRequest(BaseModel):
    platform: PushPlatform
    endpoint: str = Field(..., min_length=1)
    p256dh: str | None = None
    auth: str | None = None

    @model_validator(mode="after")
    def _validate_webpush_keys(self) -> "PushSubscribeRequest":
        if self.platform == PushPlatform.webpush and (not self.p256dh or not self.auth):
            raise ValueError("webpush subscriptions require p256dh and auth")
        return self


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=1)
