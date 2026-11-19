from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ApprovalStatusValue = Literal[
    "pending",
    "approved",
    "revision_required",
]


class ApprovalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class ApprovalUpdate(BaseModel):
    status: ApprovalStatusValue
    comments: str | None = None


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: str
    project_id: str
    title: str
    submitted_by: str
    reviewer_id: str | None = None
    status: ApprovalStatusValue
    comments: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
