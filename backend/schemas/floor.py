from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: str = Field(min_length=1, max_length=100)
    area_sqm: float | None = Field(default=None, ge=0)
    geometry: dict[str, Any] | None = None
    materials: dict[str, Any] | None = None


class RoomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: str | None = Field(default=None, min_length=1, max_length=100)
    area_sqm: float | None = Field(default=None, ge=0)
    geometry: dict[str, Any] | None = None
    materials: dict[str, Any] | None = None


class RoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    floor_id: str
    name: str
    type: str
    area_sqm: float | None = None
    geometry: dict[str, Any] | None = None
    materials: dict[str, Any] | None = None


class FloorCreate(BaseModel):
    level_number: int
    name: str = Field(min_length=1, max_length=255)
    area_sqm: float | None = Field(default=None, ge=0)


class FloorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    level_number: int | None = None
    area_sqm: float | None = Field(default=None, ge=0)
    plan_data: dict[str, Any] | None = None


class FloorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    level_number: int
    name: str
    area_sqm: float | None = None
    plan_data: dict[str, Any] | None = None
    created_at: datetime | None = None
    rooms: list[RoomResponse] = Field(default_factory=list)


class FloorListResponse(BaseModel):
    floors: list[FloorResponse]
    total: int


class RoomBatchImportRequest(BaseModel):
    rooms: list[RoomCreate] = Field(default_factory=list)


class RoomBatchImportResponse(BaseModel):
    imported_count: int
    updated_count: int
    rooms: list[RoomResponse]

