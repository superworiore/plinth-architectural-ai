"""SQLAlchemy ORM models for PLINTH."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# â”€â”€ Enums â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    PROJECT_ADMIN = "project_admin"
    ARCHITECT = "architect"
    INTERIOR_DESIGNER = "interior_designer"
    BUILDER = "builder"
    STRUCTURAL_ENGINEER = "structural_engineer"
    SITE_ENGINEER = "site_engineer"
    VENDOR = "vendor"
    CLIENT = "client"
    STUDENT = "student"
    HOMEOWNER = "homeowner"



class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"
    DESIGN = "design"
    REVIEW = "review"
    APPROVED = "approved"
    CONSTRUCTION = "construction"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ProjectTypology(str, enum.Enum):
    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    MIXED_USE = "mixed_use"
    INSTITUTIONAL = "institutional"
    HOSPITALITY = "hospitality"
    INDUSTRIAL = "industrial"


class ComplianceStatus(str, enum.Enum):
    PASSING = "passing"
    FAILING = "failing"
    IN_REVIEW = "in_review"
    NOT_CHECKED = "not_checked"


class DocumentType(str, enum.Enum):
    FLOOR_PLAN = "floor_plan"
    ELEVATION = "elevation"
    SECTION = "section"
    RENDER = "render"
    REPORT = "report"
    BOQ = "boq"
    SPECIFICATION = "specification"
    OTHER = "other"


# â”€â”€ Models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    users: Mapped[list["User"]] = relationship(back_populates="organization")
    projects: Mapped[list["Project"]] = relationship(back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.CLIENT)
    org_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    organization: Mapped[Organization | None] = relationship(back_populates="users")
    project_memberships: Mapped[list["ProjectMember"]] = relationship(back_populates="user")
    activities: Mapped[list["Activity"]] = relationship(back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    org_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.DRAFT)
    typology: Mapped[ProjectTypology] = mapped_column(Enum(ProjectTypology), default=ProjectTypology.RESIDENTIAL)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    plot_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    budget: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    spent: Mapped[float | None] = mapped_column(Numeric(15, 2), default=0)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    organization: Mapped[Organization | None] = relationship(back_populates="projects")
    creator: Mapped[User] = relationship(foreign_keys=[created_by])
    members: Mapped[list["ProjectMember"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    floors: Mapped[list["Floor"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    cost_items: Mapped[list["CostItem"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    compliance_checks: Mapped[list["ComplianceCheck"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    activities: Mapped[list["Activity"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.CLIENT)

    # Relationships
    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="project_memberships")


class Floor(Base):
    __tablename__ = "floors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    level_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    plan_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    project: Mapped[Project] = relationship(back_populates="floors")
    rooms: Mapped[list["Room"]] = relationship(back_populates="floor", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    floor_id: Mapped[str] = mapped_column(String(36), ForeignKey("floors.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)  # bedroom, kitchen, bathroom, etc.
    area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    geometry: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    materials: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    floor: Mapped[Floor] = relationship(back_populates="rooms")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[DocumentType] = mapped_column(Enum(DocumentType), default=DocumentType.OTHER)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    project: Mapped[Project] = relationship(back_populates="documents")
    uploader: Mapped[User] = relationship(foreign_keys=[uploaded_by])


class CostItem(Base):
    __tablename__ = "cost_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    unit: Mapped[str] = mapped_column(String(50), default="nos")
    unit_rate: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(15, 2), default=0)

    # Relationships
    project: Mapped[Project] = relationship(back_populates="cost_items")


class ComplianceCheck(Base):
    __tablename__ = "compliance_checks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    rule_code: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ComplianceStatus] = mapped_column(Enum(ComplianceStatus), default=ComplianceStatus.NOT_CHECKED)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    project: Mapped[Project] = relationship(back_populates="compliance_checks")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    extra_data: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    project: Mapped[Project] = relationship(back_populates="activities")
    user: Mapped[User] = relationship(back_populates="activities")


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REVISION_REQUIRED = "revision_required"


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DesignApproval(Base):
    __tablename__ = "design_approvals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    submitted_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    reviewer_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    status: Mapped[ApprovalStatus] = mapped_column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    project: Mapped[Project] = relationship()
    submitter: Mapped[User] = relationship(foreign_keys=[submitted_by])
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewer_id])


class VendorItem(Base):
    __tablename__ = "vendor_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    material_spec: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    stock_status: Mapped[str] = mapped_column(String(50), default="in_stock")
    catalog_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    vendor: Mapped[User] = relationship(foreign_keys=[vendor_id])


class VendorQuotation(Base):
    __tablename__ = "vendor_quotations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    vendor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    item_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("vendor_items.id"), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=1)
    quoted_total: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    status: Mapped[str] = mapped_column(String(50), default="submitted")  # submitted, accepted, rejected
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    project: Mapped[Project] = relationship()
    vendor: Mapped[User] = relationship(foreign_keys=[vendor_id])
    item: Mapped[VendorItem | None] = relationship()


class SiteLog(Base):
    __tablename__ = "site_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    log_date: Mapped[str] = mapped_column(String(20), nullable=False)
    weather: Mapped[str | None] = mapped_column(String(100), nullable=True)
    manpower_count: Mapped[int] = mapped_column(Integer, default=0)
    progress_notes: Mapped[str] = mapped_column(Text, nullable=False)
    safety_issues: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    project: Mapped[Project] = relationship()
    author: Mapped[User] = relationship(foreign_keys=[author_id])

