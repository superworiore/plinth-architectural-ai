from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import ComplianceCheck, ComplianceStatus
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()


def _compliance_summary(checks):
    return {
        "checks": [
            {
                "id": check.id,
                "project_id": check.project_id,
                "rule_code": check.rule_code,
                "description": check.description,
                "status": (
                    check.status.value
                    if hasattr(check.status, "value")
                    else check.status
                ),
                "detail": check.detail,
                "checked_at": check.checked_at,
            }
            for check in checks
        ],
        "passing": sum(
            check.status == ComplianceStatus.PASSING
            or check.status == ComplianceStatus.PASSING.value
            for check in checks
        ),
        "failing": sum(
            check.status == ComplianceStatus.FAILING
            or check.status == ComplianceStatus.FAILING.value
            for check in checks
        ),
        "in_review": sum(
            check.status == ComplianceStatus.IN_REVIEW
            or check.status == ComplianceStatus.IN_REVIEW.value
            for check in checks
        ),
        "not_checked": sum(
            check.status == ComplianceStatus.NOT_CHECKED
            or check.status == ComplianceStatus.NOT_CHECKED.value
            for check in checks
        )
    }


@router.get("/projects/{project_id}/compliance")
def get_project_compliance(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    checks = (
        db.query(ComplianceCheck)
        .filter(ComplianceCheck.project_id == project_id)
        .order_by(ComplianceCheck.checked_at.desc())
        .all()
    )

    return _compliance_summary(checks)

@router.post("/projects/{project_id}/compliance/run")
def run_project_compliance(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    # Get project
    from models import Project

    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from services.compliance_engine import run_compliance_checks
    checks = run_compliance_checks(project, db)

    return _compliance_summary(checks)