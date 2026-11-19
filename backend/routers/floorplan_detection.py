
"""PLINTH floor-plan object detection API."""

import base64
import io
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from ultralytics import YOLO

from models import User
from utils.dependencies import get_current_user

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = (
    PROJECT_ROOT
    / "ml"
    / "floorplan_detector"
    / "weights"
    / "improved_best.pt"
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

_model = None


def get_model():
    global _model

    if _model is None:
        if not MODEL_PATH.is_file():
            raise HTTPException(
                status_code=503,
                detail=f"Floor-plan model not found: {MODEL_PATH}",
            )

        try:
            _model = YOLO(str(MODEL_PATH))
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="Could not load the floor-plan detection model.",
            ) from exc

    return _model


@router.get("/health")
def floorplan_health():
    return {
        "feature": "floorplan-detection",
        "model_exists": MODEL_PATH.is_file(),
        "model_loaded": _model is not None,
        "classes": ["door", "window", "zone"],
    }


@router.post("/detect")
async def detect_floorplan(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPEG, PNG, or WebP image.",
        )

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image exceeds the 10 MB upload limit.",
        )

    try:
        with Image.open(io.BytesIO(contents)) as source:
            if source.format not in ALLOWED_FORMATS:
                raise HTTPException(
                    status_code=415,
                    detail="Unsupported image format.",
                )
            source.verify()

        with Image.open(io.BytesIO(contents)) as source:
            image = source.convert("RGB")

    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image could not be read.",
        ) from exc

    model = get_model()

    try:
        results = model.predict(
            source=image,
            imgsz=640,
            conf=0.25,
            device="cpu",
            verbose=False,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Floor-plan inference failed.",
        ) from exc

    result = results[0]
    detections = []

    for box in result.boxes:
        class_id = int(box.cls.item())
        x1, y1, x2, y2 = [
            round(float(value), 2)
            for value in box.xyxy[0].tolist()
        ]

        norm_x1 = max(0.0, min(1.0, round(x1 / image.width, 4))) if image.width > 0 else 0.0
        norm_y1 = max(0.0, min(1.0, round(y1 / image.height, 4))) if image.height > 0 else 0.0
        norm_x2 = max(0.0, min(1.0, round(x2 / image.width, 4))) if image.width > 0 else 0.0
        norm_y2 = max(0.0, min(1.0, round(y2 / image.height, 4))) if image.height > 0 else 0.0

        detections.append({
            "class_id": class_id,
            "class_name": model.names[class_id],
            "confidence": round(float(box.conf.item()), 4),
            "bbox_xyxy": [x1, y1, x2, y2],
            "bbox_norm": [norm_x1, norm_y1, norm_x2, norm_y2],
        })

    annotated_bgr = result.plot()
    annotated_rgb = annotated_bgr[:, :, ::-1]

    output = io.BytesIO()
    Image.fromarray(annotated_rgb).save(
        output,
        format="JPEG",
        quality=90,
    )

    image_data = base64.b64encode(
        output.getvalue()
    ).decode("ascii")

    return {
        "success": True,
        "filename": file.filename,
        "image_width": image.width,
        "image_height": image.height,
        "detection_count": len(detections),
        "detections": detections,
        "annotated_image": f"data:image/jpeg;base64,{image_data}",
        "model": "improved_best.pt",
        "note": (
            "Detections are AI estimates, not verified architectural "
            "measurements or building-code compliance results."
        ),
    }
