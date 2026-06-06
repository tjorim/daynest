from pydantic import BaseModel


class CalendarTokenResponse(BaseModel):
    token: str


class CalendarFeedResponse(BaseModel):
    token: str
    feed_url: str
