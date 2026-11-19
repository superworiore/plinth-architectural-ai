import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import Document, DocumentType
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()

UPLOAD_DIR = Path("uploads/documents")
MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".webp",
    ".doc", ".docx", ".xls", ".xlsx", ".csv",
    ".txt", ".dwg", ".dxf",
}


def _document_response(document):
    return {
        "id": document.id,
        "project_id": document.project_id,
        "title": document.title,
        "type": (
            document.type.value
            if hasattr(document.type, "value")
            else document.type
        ),
        "file_url": document.file_url,
        "version": document.version,
        "uploaded_by": document.uploaded_by,
        "created_at": document.created_at,
    }


@router.get("/projects/{project_id}/documents")
def list_project_documents(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    documents = (
        db.query(Document)
        .filter(Document.project_id == project_id)
        .order_by(Document.created_at.desc())
        .all()
    )

    return {
        "documents": [_document_response(doc) for doc in documents],
        "total": len(documents),
    }


@router.post(
    "/projects/{project_id}/upload",
    status_code=status.HTTP_201_CREATED,
)
async def upload_project_document(
    project_id: str,
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    try:
        document_type = DocumentType(doc_type)
    except ValueError:
        allowed = [item.value for item in DocumentType]
        raise HTTPException(
            status_code=422,
            detail=f"Invalid doc_type. Allowed values: {allowed}",
        )

    original_name = Path(file.filename or "upload").name
    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file extension",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}{extension}"
    destination = UPLOAD_DIR / stored_name

    size = 0
    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File exceeds the 20 MB upload limit",
                    )
                output.write(chunk)

        document = Document(
            project_id=project_id,
            title=original_name,
            type=document_type,
            file_url=f"/uploads/documents/{stored_name}",
            version=1,
            uploaded_by=current_user.id,
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        return _document_response(document)

    except Exception:
        if destination.exists():
            destination.unlink()
        raise
    finally:
        await file.close()
