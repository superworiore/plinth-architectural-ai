from datetime import datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from database import get_db
from models import Project, User, UserRole, VendorItem, VendorQuotation
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()


class VendorItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    material_spec: str | None = None
    unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    stock_status: str = Field(default="in_stock", max_length=50)
    catalog_url: str | None = Field(default=None, max_length=500)


class VendorItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    material_spec: str | None = None
    unit_price: Decimal | None = Field(default=None, ge=0)
    stock_status: str | None = Field(default=None, max_length=50)
    catalog_url: str | None = Field(default=None, max_length=500)


class VendorItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    title: str
    category: str
    material_spec: str | None = None
    unit_price: Decimal
    stock_status: str
    catalog_url: str | None = None
    created_at: datetime | None = None


class QuotationCreate(BaseModel):
    item_id: str | None = None
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    quoted_total: Decimal = Field(ge=0)
    notes: str | None = None


class QuotationStatusUpdate(BaseModel):
    status: Literal["submitted", "accepted", "rejected"]


class QuotationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    vendor_id: str
    item_id: str | None = None
    quantity: Decimal
    quoted_total: Decimal
    status: str
    notes: str | None = None
    created_at: datetime | None = None


def require_vendor(user: User) -> None:
    if user.role not in (UserRole.VENDOR, UserRole.SUPER_ADMIN, UserRole.PROJECT_ADMIN):
        raise HTTPException(
            status_code=403,
            detail="A vendor account is required for this operation",
        )


@router.get("/vendor-items")
def list_vendor_items(
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VendorItem)

    # Vendors can see their own catalog; other users can browse the catalog.
    if current_user.role == UserRole.VENDOR:
        query = query.filter(VendorItem.vendor_id == current_user.id)

    if category:
        query = query.filter(VendorItem.category == category)

    items = query.order_by(VendorItem.created_at.desc()).all()
    return {
        "items": [VendorItemResponse.model_validate(item) for item in items],
        "total": len(items),
    }


@router.post("/vendor-items", response_model=VendorItemResponse, status_code=201)
def create_vendor_item(
    body: VendorItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_vendor(current_user)

    item = VendorItem(vendor_id=current_user.id, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/vendor-items/{item_id}", response_model=VendorItemResponse)
def update_vendor_item(
    item_id: str,
    body: VendorItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(VendorItem).filter(VendorItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Vendor item not found")

    if item.vendor_id != current_user.id and current_user.role not in (
        UserRole.SUPER_ADMIN, UserRole.PROJECT_ADMIN
    ):
        raise HTTPException(status_code=403, detail="You cannot edit this vendor item")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/vendor-items/{item_id}", status_code=204)
def delete_vendor_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(VendorItem).filter(VendorItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Vendor item not found")

    if item.vendor_id != current_user.id and current_user.role not in (
        UserRole.SUPER_ADMIN, UserRole.PROJECT_ADMIN
    ):
        raise HTTPException(status_code=403, detail="You cannot delete this vendor item")

    db.delete(item)
    db.commit()


@router.get("/projects/{project_id}/vendor-quotations")
def list_quotations(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    quotations = (
        db.query(VendorQuotation)
        .filter(VendorQuotation.project_id == project_id)
        .order_by(VendorQuotation.created_at.desc())
        .all()
    )
    return {
        "quotations": [
            QuotationResponse.model_validate(q) for q in quotations
        ],
        "total": len(quotations),
    }


@router.post(
    "/projects/{project_id}/vendor-quotations",
    response_model=QuotationResponse,
    status_code=201,
)
def create_quotation(
    project_id: str,
    body: QuotationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    if current_user.role != UserRole.VENDOR:
        raise HTTPException(
            status_code=403,
            detail="Only vendor accounts can submit quotations",
        )

    if body.item_id:
        item = db.query(VendorItem).filter(VendorItem.id == body.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Vendor item not found")
        if item.vendor_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only quote your own catalog items",
            )

    quotation = VendorQuotation(
        project_id=project_id,
        vendor_id=current_user.id,
        **body.model_dump(),
    )
    db.add(quotation)
    db.commit()
    db.refresh(quotation)
    return quotation


@router.patch(
    "/vendor-quotations/{quotation_id}/status",
    response_model=QuotationResponse,
)
def update_quotation_status(
    quotation_id: str,
    body: QuotationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quotation = (
        db.query(VendorQuotation)
        .filter(VendorQuotation.id == quotation_id)
        .first()
    )
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    check_project_access(quotation.project_id, current_user, db)

    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.PROJECT_ADMIN):
        if current_user.id == quotation.vendor_id:
            raise HTTPException(
                status_code=403,
                detail="Vendors cannot approve or reject their own quotations",
            )

        raise HTTPException(
            status_code=403,
            detail="Only project administrators can change quotation status",
        )

    quotation.status = body.status
    db.commit()
    db.refresh(quotation)
    return quotation
