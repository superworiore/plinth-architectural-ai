"""Tests for PLINTH floor-plan YOLO AI detection and integration."""
import io
import pytest
from PIL import Image

from models import User
from tests.conftest import TestSessionLocal
from utils.security import create_access_token, hash_password


@pytest.fixture
def other_user():
    """Create a second user who does NOT have access to test_project."""
    db = TestSessionLocal()
    user = User(
        email="unauthorized@plinth.ai",
        hashed_password=hash_password("otherpass123"),
        full_name="Unauthorized User",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id})
    user_id = user.id
    db.close()
    return {"email": "unauthorized@plinth.ai", "token": token, "id": user_id}


@pytest.fixture
def other_auth_headers(other_user):
    return {"Authorization": f"Bearer {other_user['token']}"}


@pytest.fixture
def test_floor(client, auth_headers, test_project):
    """Create a floor under test_project."""
    pid = test_project["id"]
    response = client.post(
        f"/api/projects/{pid}/floors",
        json={
            "level_number": 0,
            "name": "Ground Floor",
            "area_sqm": 200.0,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def create_test_image_bytes(format="JPEG", size=(640, 480), color="white"):
    """Helper to generate a valid in-memory test image."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    buf.seek(0)
    return buf.getvalue()


def test_floorplan_health(client):
    """Health check endpoint should report feature availability."""
    res = client.get("/api/ai/floorplan/health")
    assert res.status_code == 200
    data = res.json()
    assert data["feature"] == "floorplan-detection"
    assert "classes" in data
    assert "door" in data["classes"]
    assert "window" in data["classes"]
    assert "zone" in data["classes"]


def test_detect_floorplan_requires_auth(client):
    """Unauthenticated requests must be rejected with 403."""
    img_bytes = create_test_image_bytes()
    files = {"file": ("test_plan.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/ai/floorplan/detect", files=files)
    assert res.status_code == 403


def test_detect_floorplan_unsupported_format(client, auth_headers):
    """Non-image files must be rejected with 415."""
    fake_txt = io.BytesIO(b"not an image file content")
    files = {"file": ("plan.txt", fake_txt, "text/plain")}
    res = client.post("/api/ai/floorplan/detect", files=files, headers=auth_headers)
    assert res.status_code == 415


def test_detect_floorplan_empty_file(client, auth_headers):
    """Empty files must be rejected with 400."""
    empty = io.BytesIO(b"")
    files = {"file": ("empty.jpg", empty, "image/jpeg")}
    res = client.post("/api/ai/floorplan/detect", files=files, headers=auth_headers)
    assert res.status_code == 400


def test_detect_floorplan_inference_success(client, auth_headers):
    """Valid image triggers YOLO inference and returns structured detection response."""
    img_bytes = create_test_image_bytes("JPEG", (640, 480))
    files = {"file": ("floorplan_sample.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/ai/floorplan/detect", files=files, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    assert data["image_width"] == 640
    assert data["image_height"] == 480
    assert "detection_count" in data
    assert "detections" in data
    assert isinstance(data["detections"], list)
    assert data["annotated_image"].startswith("data:image/jpeg;base64,")

    # Verify detection structure if any boxes found
    for det in data["detections"]:
        assert "class_name" in det
        assert det["class_name"] in ("door", "window", "zone")
        assert "confidence" in det
        assert 0.0 <= det["confidence"] <= 1.0
        assert len(det["bbox_xyxy"]) == 4
        if "bbox_norm" in det:
            assert len(det["bbox_norm"]) == 4
            for coord in det["bbox_norm"]:
                assert 0.0 <= coord <= 1.0


def test_import_approved_detection_to_floor(client, auth_headers, test_floor):
    """Approved room detections are saved as real room records in the database."""
    fid = test_floor["id"]

    # Simulated approved detection room record
    room_payload = {
        "name": "Living Zone 01",
        "type": "living",
        "area_sqm": 35.5,
        "geometry": {
            "x": 12,
            "y": 10,
            "w": 26,
            "h": 20,
            "orientation": "NE",
            "source": "yolo_detection",
            "confidence": 0.895,
        },
    }

    res = client.post(f"/api/floors/{fid}/rooms", json=room_payload, headers=auth_headers)
    assert res.status_code == 201
    room = res.json()
    assert room["name"] == "Living Zone 01"
    assert room["type"] == "living"
    assert room["area_sqm"] == 35.5
    assert room["geometry"]["source"] == "yolo_detection"
    assert room["geometry"]["confidence"] == 0.895

    # Verify floor now contains the imported room
    floor_res = client.get(f"/api/floors/{fid}", headers=auth_headers)
    assert floor_res.status_code == 200
    assert any(r["id"] == room["id"] for r in floor_res.json()["rooms"])


def test_import_detection_authorization_isolation(
    client, other_auth_headers, test_floor
):
    """Unauthorized users cannot import detected rooms into another user's floor."""
    fid = test_floor["id"]
    room_payload = {
        "name": "Unauthorized Injected Room",
        "type": "room",
        "area_sqm": 25.0,
    }
    res = client.post(
        f"/api/floors/{fid}/rooms", json=room_payload, headers=other_auth_headers
    )
    assert res.status_code == 403
