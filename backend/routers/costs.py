from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from database import get_db
from models import CostItem, Project
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()


class CostCreate(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    description: str
    quantity: Decimal = Field(gt=0)
    unit: str = Field(min_length=1, max_length=50)
    unit_rate: Decimal = Field(ge=0)


class CostUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    quantity: Decimal | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    unit_rate: Decimal | None = Field(default=None, ge=0)


class CostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    category: str
    description: str
    quantity: Decimal
    unit: str
    unit_rate: Decimal
    total: Decimal


def _cost_summary(project, items):
    total_estimated = sum(
        (Decimal(str(item.total or 0)) for item in items), Decimal("0")
    )
    total_spent = Decimal(str(project.spent or 0))
    total_budget = Decimal(str(project.budget or 0))

    category_totals = {}
    for item in items:
        category_totals[item.category] = (
            category_totals.get(item.category, Decimal("0"))
            + Decimal(str(item.total or 0))
        )

    by_category = [
        {
            "category": category,
            "total": float(amount),
            "percent": (
                round(float(amount / total_estimated * 100), 2)
                if total_estimated else 0
            ),
        }
        for category, amount in sorted(category_totals.items())
    ]

    variance_percent = (
        round(float((total_budget - total_estimated) / total_budget * 100), 2)
        if total_budget else 0
    )

    return {
        "total_budget": float(total_budget),
        "total_spent": float(total_spent),
        "total_estimated": float(total_estimated),
        "variance_percent": variance_percent,
        "by_category": by_category,
    }


@router.get("/projects/{project_id}/costs")
def list_project_costs(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()
    items = (
        db.query(CostItem)
        .filter(CostItem.project_id == project_id)
        .order_by(CostItem.category, CostItem.description)
        .all()
    )

    return {
        "items": [CostResponse.model_validate(item) for item in items],
        "summary": _cost_summary(project, items),
    }


@router.post(
    "/projects/{project_id}/costs",
    response_model=CostResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_cost(
    project_id: str,
    body: CostCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    total = (body.quantity * body.unit_rate).quantize(Decimal("0.01"))
    item = CostItem(
        project_id=project_id,
        category=body.category,
        description=body.description,
        quantity=body.quantity,
        unit=body.unit,
        unit_rate=body.unit_rate,
        total=total,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return CostResponse.model_validate(item)


@router.patch("/costs/{cost_id}", response_model=CostResponse)
def update_cost(
    cost_id: str,
    body: CostUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = db.query(CostItem).filter(CostItem.id == cost_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Cost item not found")

    check_project_access(item.project_id, current_user, db)

    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(item, field, value)

    if "quantity" in changes or "unit_rate" in changes:
        quantity = Decimal(str(item.quantity))
        unit_rate = Decimal(str(item.unit_rate))
        item.total = (quantity * unit_rate).quantize(Decimal("0.01"))

    db.commit()
    db.refresh(item)
    return CostResponse.model_validate(item)


@router.delete("/costs/{cost_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost(
    cost_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = db.query(CostItem).filter(CostItem.id == cost_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Cost item not found")

    check_project_access(item.project_id, current_user, db)
    db.delete(item)
    db.commit()
