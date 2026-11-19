from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from database import get_db
from models import SiteLog, User
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()


class SiteLogCreate(BaseModel):
    log_date: date
    weather: str | None = Field(default=None, max_length=100)
    manpower_count: int = Field(default=0, ge=0)
    progress_notes: str = Field(min_length=1)
    safety_issues: str | None = None


class SiteLogUpdate(BaseModel):
    log_date: date | None = None
    weather: str | None = Field(default=None, max_length=100)
    manpower_count: int | None = Field(default=None, ge=0)
    progress_notes: str | None = Field(default=None, min_length=1)
    safety_issues: str | None = None


class SiteLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    author_id: str
    log_date: str
    weather: str | None = None
    manpower_count: int
    progress_notes: str
    safety_issues: str | None = None
    created_at: object | None = None


@router.get("/projects/{project_id}/site-logs")
def list_site_logs(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    logs = (
        db.query(SiteLog)
        .filter(SiteLog.project_id == project_id)
        .order_by(SiteLog.log_date.desc(), SiteLog.created_at.desc())
        .all()
    )

    return {
        "site_logs": [SiteLogResponse.model_validate(log) for log in logs],
        "total": len(logs),
    }


@router.post("/projects/{project_id}/site-logs", response_model=SiteLogResponse, status_code=201)
def create_site_log(
    project_id: str,
    body: SiteLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    log = SiteLog(
        project_id=project_id,
        author_id=current_user.id,
        log_date=body.log_date.isoformat(),
        weather=body.weather,
        manpower_count=body.manpower_count,
        progress_notes=body.progress_notes,
        safety_issues=body.safety_issues,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.patch("/site-logs/{log_id}", response_model=SiteLogResponse)
def update_site_log(
    log_id: str,
    body: SiteLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(SiteLog).filter(SiteLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Site log not found")

    check_project_access(log.project_id, current_user, db)

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "log_date" and value is not None:
            value = value.isoformat()
        setattr(log, field, value)

    db.commit()
    db.refresh(log)
    return log


@router.delete("/site-logs/{log_id}", status_code=204)
def delete_site_log(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(SiteLog).filter(SiteLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Site log not found")

    check_project_access(log.project_id, current_user, db)

    db.delete(log)
    db.commit()
