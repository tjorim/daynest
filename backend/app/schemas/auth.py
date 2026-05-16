from pydantic import BaseModel


class UserMeResponse(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    is_active: bool
    roles: list[str] = []
