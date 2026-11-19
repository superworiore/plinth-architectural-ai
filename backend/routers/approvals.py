from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import ApprovalStatus, DesignApproval
from schemas.approval import (
    ApprovalCreate,
    ApprovalResponse,
    ApprovalUpdate,
)
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()


@router.get(
    "/projects/{project_id}/approvals",
    response_model=list[ApprovalResponse],
)
def list_approvals(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)
    approvals = (
        db.query(DesignApproval)
        .filter(DesignApproval.project_id == project_id)
        .order_by(DesignApproval.created_at.desc())
        .all()
    )
    return [ApprovalResponse.model_validate(a) for a in approvals]


@router.post(
    "/projects/{project_id}/approvals",
    response_model=ApprovalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_approval(
    project_id: str,
    body: ApprovalCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)
    approval = DesignApproval(
        project_id=project_id,
        title=body.title,
        submitted_by=current_user.id,
        status=ApprovalStatus.PENDING,
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    return ApprovalResponse.model_validate(approval)


@router.patch(
    "/approvals/{approval_id}",
    response_model=ApprovalResponse,
)
def update_approval(
    approval_id: str,
    body: ApprovalUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    approval = (
        db.query(DesignApproval)
        .filter(DesignApproval.id == approval_id)
        .first()
    )
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval not found")

    check_project_access(approval.project_id, current_user, db)

    if approval.submitted_by == current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot review your own approval request",
        )

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail="Only pending approval requests can be reviewed",
        )

    approval.status = ApprovalStatus(body.status)
    approval.comments = body.comments
    approval.reviewer_id = current_user.id

    db.commit()
    db.refresh(approval)
    return ApprovalResponse.model_validate(approval)
