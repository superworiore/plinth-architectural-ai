from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Activity
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()


@router.get("/projects/{project_id}/activity")
def list_project_activity(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    activities = (
        db.query(Activity)
        .filter(Activity.project_id == project_id)
        .order_by(Activity.created_at.desc())
        .all()
    )

    return {
        "activities": [
            {
                "id": item.id,
                "project_id": item.project_id,
                "user_id": item.user_id,
                "action": item.action,
                "metadata": item.extra_data,
                "created_at": item.created_at,
            }
            for item in activities
        ],
        "total": len(activities),
    }
