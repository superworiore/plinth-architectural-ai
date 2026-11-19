"""Seed the database with realistic demo data for PLINTH."""

from database import Base, SessionLocal, engine
from models import (
    Activity,
    ComplianceCheck,
    ComplianceStatus,
    CostItem,
    Document,
    DocumentType,
    Floor,
    Organization,
    Project,
    ProjectMember,
    ProjectStatus,
    ProjectTypology,
    Room,
    User,
    UserRole,
)
from utils.security import hash_password


def seed():
    """Populate the database with demo data."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if already seeded
    if db.query(User).filter(User.email == "architect@plinth.ai").first():
        print("Database already seeded. Skipping.")
        db.close()
        return

    print("Seeding database...")

    # â”€â”€ Organization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    org = Organization(name="PLINTH Studio", slug="plinth-studio")
    db.add(org)
    db.flush()

    # â”€â”€ Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    users_data = [
        {"email": "admin@plinth.ai", "full_name": "Arjun Reddy", "role": UserRole.SUPER_ADMIN},
        {"email": "architect@plinth.ai", "full_name": "Sneha Iyer", "role": UserRole.ARCHITECT},
        {"email": "interior@plinth.ai", "full_name": "Maya Kapoor", "role": UserRole.INTERIOR_DESIGNER},
        {"email": "structural@plinth.ai", "full_name": "Rohan Mehta", "role": UserRole.STRUCTURAL_ENGINEER},
        {"email": "client@plinth.ai", "full_name": "Vikram Shah", "role": UserRole.CLIENT},
    ]

    users = {}
    for u in users_data:
        user = User(
            email=u["email"],
            hashed_password=hash_password("demo1234"),
            full_name=u["full_name"],
            role=u["role"],
            org_id=org.id,
        )
        db.add(user)
        users[u["email"]] = user

    db.flush()

    # ── Demo Project ──────────────────────────────────────────────────────────
    architect = users["architect@plinth.ai"]
    project = Project(
        name="The Glass Pavilion",
        code="PRJ-001",
        org_id=org.id,
        created_by=architect.id,
        status=ProjectStatus.DESIGN,
        typology=ProjectTypology.RESIDENTIAL,
        location="Bengaluru, Karnataka, India",
        budget=15000000.0,
        spent=3200000.0,
        progress=35.0,
        plot_data={
            "width": 18.29,
            "length": 24.38,
            "area": 445.9,
            "setbacks": {"front": 4.5, "rear": 3.0, "side1": 2.0, "side2": 2.0},
            "max_far": 1.75,
            "proposed_far": 1.25,
            "max_height_m": 12.0,
            "proposed_height_m": 8.5,
            "max_coverage_pct": 60,
            "proposed_coverage_pct": 42.5,
        },
    )
    db.add(project)
    db.flush()

    # ── Project Members ───────────────────────────────────────────────────────
    for u in users.values():
        member = ProjectMember(
            project_id=project.id,
            user_id=u.id,
            role=u.role,
        )
        db.add(member)

    # ── Floors & Rooms ────────────────────────────────────────────────────────
    ground_floor = Floor(
        project_id=project.id,
        level_number=0,
        name="Ground Floor",
        area_sqm=180.0,
    )
    first_floor = Floor(
        project_id=project.id,
        level_number=1,
        name="First Floor",
        area_sqm=120.0,
    )
    db.add(ground_floor)
    db.add(first_floor)
    db.flush()

    rooms_data = [
        {"name": "Living Room", "type": "living", "area_sqm": 36.0, "geometry": {"x": 8, "y": 8, "w": 28, "h": 20}},
        {"name": "Kitchen", "type": "kitchen", "area_sqm": 16.0, "geometry": {"x": 38, "y": 8, "w": 18, "h": 16}},
        {"name": "Dining Area", "type": "dining", "area_sqm": 18.0, "geometry": {"x": 38, "y": 26, "w": 18, "h": 16}},
        {"name": "Master Bedroom", "type": "bedroom", "area_sqm": 24.0, "geometry": {"x": 8, "y": 30, "w": 22, "h": 16}},
        {"name": "Ensuite Bathroom", "type": "bathroom", "area_sqm": 8.0, "geometry": {"x": 32, "y": 30, "w": 12, "h": 12}},
    ]

    for r in rooms_data:
        room = Room(
            floor_id=ground_floor.id,
            name=r["name"],
            type=r["type"],
            area_sqm=r["area_sqm"],
            geometry=r["geometry"],
        )
        db.add(room)

    db.commit()
    print("Database successfully seeded with demo project, floors, and rooms.")
    db.close()


if __name__ == "__main__":
    seed()