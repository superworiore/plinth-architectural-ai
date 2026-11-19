"""Project Export routes â€” PDF Architectural Report & BOQ CSV Export (PDF Section 2.1)."""

import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import ComplianceCheck, CostItem, DesignApproval, Floor, Project, User
from utils.dependencies import get_current_user

router = APIRouter()


@router.get("/projects/{project_id}/export/pdf")
def export_project_pdf(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate printable PDF / HTML architectural project summary report (PDF Section 2.1)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    floors = db.query(Floor).options(joinedload(Floor.rooms)).filter(Floor.project_id == project_id).all()
    costs = db.query(CostItem).filter(CostItem.project_id == project_id).all()
    compliance = db.query(ComplianceCheck).filter(ComplianceCheck.project_id == project_id).all()
    approvals = db.query(DesignApproval).filter(DesignApproval.project_id == project_id).all()

    total_cost = sum(float(c.total) for c in costs)
    budget = float(project.budget) if project.budget else 0.0

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>PLINTH Architectural Report â€” {project.name}</title>
    <style>
        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #111; line-height: 1.5; }}
        h1 {{ font-size: 24px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 5px; }}
        .meta {{ font-size: 12px; color: #666; font-family: monospace; margin-bottom: 30px; }}
        .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }}
        .card {{ border: 1px solid #e0e0e0; padding: 15px; background: #fafafa; }}
        .card-title {{ font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 5px; }}
        .card-value {{ font-size: 20px; font-weight: bold; }}
        table {{ w-width: 100%; width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }}
        th, td {{ border: 1px solid #eee; padding: 8px 12px; text-align: left; }}
        th {{ background: #f0f0f0; font-weight: 600; font-size: 11px; text-transform: uppercase; }}
        .section-header {{ font-size: 16px; font-weight: bold; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }}
        .badge {{ padding: 3px 8px; border-radius: 3px; font-size: 10px; text-transform: uppercase; font-weight: bold; }}
        .passing {{ background: #d4edda; color: #155724; }}
        .failing {{ background: #f8d7da; color: #721c24; }}
        .pending {{ background: #fff3cd; color: #856404; }}
    </style>
</head>
<body>
    <h1>PLINTH Architectural Executive Report</h1>
    <div class="meta">Project Code: {project.code} | ID: {project.id} | Typology: {project.typology.value.upper()} | Status: {project.status.value.upper()}</div>

    <div class="grid">
        <div class="card">
            <div class="card-title">Approved Budget</div>
            <div class="card-value">â‚¹{budget:,.2f}</div>
        </div>
        <div class="card">
            <div class="card-title">Estimated BOQ Total</div>
            <div class="card-value">â‚¹{total_cost:,.2f}</div>
        </div>
    </div>

    <div class="section-header">1. Spatial Floor Breakdown ({len(floors)} Floors)</div>
    <table>
        <thead>
            <tr>
                <th>Level</th>
                <th>Floor Name</th>
                <th>Rooms Count</th>
                <th>Total Area (sq ft)</th>
            </tr>
        </thead>
        <tbody>
            {"".join(f"<tr><td>Level {f.level_number}</td><td>{f.name}</td><td>{len(f.rooms)}</td><td>{sum(r.area_sqm or 0 for r in f.rooms) * 10.764:,.1f} sq ft</td></tr>" for f in floors) if floors else "<tr><td colspan='4'>No floor plans recorded.</td></tr>"}
        </tbody>
    </table>

    <div class="section-header">2. Bill of Quantities & Materials ({len(costs)} Line Items)</div>
    <table>
        <thead>
            <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Rate</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            {"".join(f"<tr><td>{c.category}</td><td>{c.description}</td><td>{c.quantity} {c.unit}</td><td>â‚¹{float(c.unit_rate):,.2f}</td><td>â‚¹{float(c.total):,.2f}</td></tr>" for c in costs) if costs else "<tr><td colspan='5'>No cost items recorded.</td></tr>"}
        </tbody>
    </table>

    <div class="section-header">3. Regulatory NBC 2016 Compliance Audit</div>
    <table>
        <thead>
            <tr>
                <th>Rule Code</th>
                <th>Description</th>
                <th>Status</th>
                <th>Detail</th>
            </tr>
        </thead>
        <tbody>
            {"".join(f"<tr><td>{c.rule_code}</td><td>{c.description}</td><td><span class='badge {c.status.value}'>{c.status.value}</span></td><td>{c.detail or ''}</td></tr>" for c in compliance) if compliance else "<tr><td colspan='4'>No compliance checks performed.</td></tr>"}
        </tbody>
    </table>

    <div class="section-header">4. Design Submission & Review Approval History</div>
    <table>
        <thead>
            <tr>
                <th>Design Title</th>
                <th>Approval Status</th>
                <th>Reviewer Comments</th>
            </tr>
        </thead>
        <tbody>
            {"".join(f"<tr><td>{a.title}</td><td><span class='badge {a.status.value}'>{a.status.value}</span></td><td>{a.comments or 'None'}</td></tr>" for a in approvals) if approvals else "<tr><td colspan='3'>No submission approval records found.</td></tr>"}
        </tbody>
    </table>
</body>
</html>"""

    return Response(
        content=html_content,
        media_type="text/html",
        headers={"Content-Disposition": f"inline; filename=PLINTH_Project_Report_{project.code}.html"},
    )


@router.get("/projects/{project_id}/export/boq")
def export_project_boq(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export Bill of Quantities (BOQ) spreadsheet in CSV format (PDF Section 2.1)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    costs = db.query(CostItem).filter(CostItem.project_id == project_id).all()

    output = io.StringIO()
    output.write("Category,Description,Quantity,Unit,Unit Rate (INR),Total Cost (INR)\n")
    for item in costs:
        output.write(
            f'"{item.category}","{item.description}",{item.quantity},"{item.unit}",{item.unit_rate},{item.total}\n'
        )

    csv_data = output.getvalue()
    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=BOQ_{project.code}.csv"},
    )
