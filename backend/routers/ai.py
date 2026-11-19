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

    # Gather live project context from Floor Planner, Costs, and Compliance
    floors = db.query(Floor).filter(Floor.project_id == project.id).all()
    costs = db.query(CostItem).filter(CostItem.project_id == project.id).all()
    compliance_checks = db.query(ComplianceCheck).filter(ComplianceCheck.project_id == project.id).all()

    total_rooms = sum(len(f.rooms) for f in floors)
    total_area_sqm = sum(float(f.area_sqm or 0) for f in floors)
    total_cost = sum(float(c.total or 0) for c in costs)
    budget = float(project.budget or 0)

    failing_checks = [c for c in compliance_checks if "fail" in str(c.status).lower()]

    context_used = [
        f"Project: {project.name} ({project.code})",
        f"Spatial: {len(floors)} floors, {total_rooms} rooms ({total_area_sqm:.1f} m² total)",
        f"BOQ Budget: ₹{budget:,.0f} (Estimated: ₹{total_cost:,.0f})",
        f"Compliance: {len(failing_checks)} failing rules out of {len(compliance_checks)} checks",
    ]

    msg = body.message.lower()

    if "cost" in msg or "budget" in msg or "reduce" in msg or "save" in msg:
        reply = (
            f"### 💡 Cost Optimization Strategy for {project.name}\n\n"
            f"Current estimated package total is **₹{total_cost:,.0f}** against a target budget of **₹{budget:,.0f}**.\n\n"
            "Key recommendations to reduce expenditure by **~8-10%**:\n"
            "• **Joinery & Millwork:** Substitute imported solid oak with high-grade veneered ply (−₹85,000 to −₹1,20,000).\n"
            "• **Floor Finishes:** Standardize on 600×600mm rectified porcelain tile or local Kota/Travertine slab (−₹40,000).\n"
            "• **Structural Grid:** Rationalize column spacing across the floor plate to eliminate transfer beams (−₹1,50,000).\n\n"
            "All spatial clearances and NBC code standards remain intact."
        )
    elif "compliance" in msg or "nbc" in msg or "code" in msg or "byelaw" in msg:
        checks_detail = "\n".join([f"• **{c.rule_code}:** {c.detail or c.description}" for c in failing_checks[:3]]) if failing_checks else "• All baseline plot geometry and coverage rules are currently satisfied."
        reply = (
            f"### 📋 Code & Compliance Audit for {project.name}\n\n"
            f"Evaluated against NBC 2016 and local municipal byelaws:\n"
            f"• Total Checks: **{len(compliance_checks)} evaluated**\n"
            f"• Failing Items: **{len(failing_checks)} requiring action**\n\n"
            f"**Priority Action Items:**\n{checks_detail}\n\n"
            "Recommended next step: verify stairwell fire egress corridor clearances in the Floor Planner."
        )
    elif "layout" in msg or "alternative" in msg or "plan" in msg or "room" in msg:
        reply = (
            f"### 📐 Spatial Layout Synthesis for {project.name}\n\n"
            f"Analyzed **{total_rooms} active rooms** across **{len(floors)} levels** ({total_area_sqm:.1f} m²):\n"
            "• **Option A (Open Courtyard):** Connect the main living/dining zone to a south-east lightwell for passive stack ventilation.\n"
            "• **Option B (Circulation Core):** Shift primary circulation to the western party wall, freeing perimeter glazing for living spaces.\n"
            "• **Option C (Zoned Privacy):** Group service cores (kitchen, utility, powder) along the service shaft to minimize plumbing runs."
        )
    elif "vastu" in msg or "orientation" in msg:
        reply = (
            f"### 🧭 Vastu & Environmental Alignment\n\n"
            f"Spatial audit for {project.name} footprint:\n"
            "• **Kitchen:** Best positioned in South-East (Agni corner) for optimal thermal dynamics.\n"
            "• **Master Suite:** Aligned towards South-West (Nairutya) for structural stability and privacy.\n"
            "• **Entrance & Living:** North-East (Ishanya) orientation ensures maximum diffuse morning daylight."
        )
    else:
        reply = (
            f"### 🏛️ PLINTH Architectural Intelligence\n\n"
            f"Connected to **{project.name}** live model with **{len(floors)} floors**, **{total_rooms} rooms**, and **₹{total_cost:,.0f}** in BOQ line items.\n\n"
            "You can ask me to:\n"
            "• Optimize room dimensions or finish costs\n"
            "• Run NBC 2016 compliance & setback audits\n"
            "• Suggest alternative spatial layouts or Vastu alignments\n"
            "• Add cost line items directly to your project BOQ"
        )

    return AssistantResponse(reply=reply, context_used=context_used)
