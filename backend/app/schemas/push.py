from pydantic import Field, model_validator

from app.core.enums import PushPlatform
from app.schemas.base import RequestModel


class PushSubscribeRequest(RequestModel):
    platform: PushPlatform
    endpoint: str = Field(..., min_length=1)
    p256dh: str | None = None
    auth: str | None = None

    @model_validator(mode="after")
    def _validate_webpush_keys(self) -> PushSubscribeRequest:
        if self.platform == PushPlatform.webpush and (not self.p256dh or not self.auth):
            raise ValueError("webpush subscriptions require p256dh and auth")
        return self


class PushUnsubscribeRequest(RequestModel):
    endpoint: str = Field(..., min_length=1)
