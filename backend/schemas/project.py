from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field
from models import ProjectStatus, ProjectTypology


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=100)
    typology: ProjectTypology = ProjectTypology.RESIDENTIAL
    location: Optional[str] = None
    budget: Optional[float] = Field(default=None, ge=0)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    code: Optional[str] = Field(default=None, min_length=1, max_length=100)
    typology: Optional[ProjectTypology] = None
    status: Optional[ProjectStatus] = None
    location: Optional[str] = None
    plot_data: Optional[dict[str, Any]] = None
    budget: Optional[float] = Field(default=None, ge=0)
    spent: Optional[float] = Field(default=None, ge=0)
    progress: Optional[float] = Field(default=None, ge=0, le=100)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    org_id: Optional[str] = None
    created_by: str
    status: ProjectStatus
    typology: ProjectTypology
    location: Optional[str] = None
    plot_data: Optional[dict[str, Any]] = None
    budget: Optional[float] = None
    spent: Optional[float] = None
    progress: float
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int
