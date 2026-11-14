from app.schemas.base import ResponseModel


class CalendarTokenResponse(ResponseModel):
    token: str


class CalendarFeedResponse(ResponseModel):
    token: str
    feed_url: str
