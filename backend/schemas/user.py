from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    avatar_url: Optional[str] = None
    role: str
    org_id: Optional[str] = None
    is_active: bool


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None
