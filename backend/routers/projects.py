"""Project CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Project, ProjectMember, User
from schemas.project import ProjectCreate, ProjectListResponse, ProjectResponse, ProjectUpdate
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()


@router.get("/", response_model=ProjectListResponse)
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all projects the current user has access to."""
    # Admins see all projects; others see only their own
    if current_user.role.value in ("super_admin", "project_admin"):
        projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    else:
        member_project_ids = (
            db.query(ProjectMember.project_id)
            .filter(ProjectMember.user_id == current_user.id)
            .scalar_subquery()
        )
        projects = (
            db.query(Project)
            .filter(
                (Project.created_by == current_user.id) | (Project.id.in_(member_project_ids))
            )
            .order_by(Project.updated_at.desc())
            .all()
        )

    return ProjectListResponse(
        projects=[ProjectResponse.model_validate(p) for p in projects],
        total=len(projects),
    )


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new project."""
    project = Project(
        name=body.name,
        code=body.code,
        typology=body.typology,
        location=body.location,
        budget=body.budget,
        created_by=current_user.id,
        org_id=current_user.org_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Auto-add creator as a project member
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=current_user.role,
    )
    db.add(member)
    db.commit()

    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single project by ID with authorization check."""
    project = check_project_access(project_id, current_user, db)
    return ProjectResponse.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a project's details with authorization check."""
    project = check_project_access(project_id, current_user, db)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Only the creator or admins can delete
    if project.created_by != current_user.id and current_user.role.value not in ("super_admin", "project_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this project")

    db.delete(project)
    db.commit()
