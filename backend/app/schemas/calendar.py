from pydantic import BaseModel


class CalendarTokenResponse(BaseModel):
    token: str
