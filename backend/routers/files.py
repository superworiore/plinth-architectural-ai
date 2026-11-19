from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Document, User
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()

UPLOAD_DIR = Path("uploads/documents").resolve()


@router.get("/files/{document_id}")
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    check_project_access(document.project_id, current_user, db)

    if not document.file_url:
        raise HTTPException(status_code=404, detail="Document has no file")

    stored_name = Path(document.file_url).name
    file_path = (UPLOAD_DIR / stored_name).resolve()

    if file_path.parent != UPLOAD_DIR or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Stored file not found")

    return FileResponse(
        path=file_path,
        filename=document.title,
        content_disposition_type="attachment",
    )
