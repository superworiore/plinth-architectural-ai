"""AI module routes â€” assistant, plot analysis, cost estimation."""

import json
import re
import math
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import Project, Floor, Room, CostItem, ComplianceCheck, User
from utils.dependencies import get_current_user

router = APIRouter()


# â”€â”€ Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AssistantRequest(BaseModel):
    project_id: str
    message: str
    history: list[ChatMessage] = []


class AssistantResponse(BaseModel):
    reply: str
    context_used: list[str] = []


class PlotAnalysisRequest(BaseModel):
    latitude: float
    longitude: float
    plot_area_sqm: float | None = None


class PlotAnalysisResponse(BaseModel):
    location: str
    zone: str
    max_far: float
    max_height_m: float
    setbacks: dict
    buildable_area_sqm: float
    solar_orientation: str
    terrain: str
    recommendations: list[str]


class CostEstimateRequest(BaseModel):
    project_id: str


class CostEstimateResponse(BaseModel):
    total_estimated: float
    cost_per_sqft: float
    breakdown: list[dict]
    recommendations: list[str]


# â”€â”€ AI Assistant Endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.post("/assistant", response_model=AssistantResponse)
def ai_assistant(
    body: AssistantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chat with PLINTH AI about a project. Uses project context + AI inference."""
    project = db.query(Project).filter(Project.id == body.project_id).first()
    if not project:
        project = db.query(Project).first()
    if not project:
        raise HTTPException(status_code=404, detail="No projects available in system")
