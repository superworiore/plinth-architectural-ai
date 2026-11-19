"""Floor and Room CRUD and authorization isolation tests."""
import pytest
from models import User
from tests.conftest import TestSessionLocal
from utils.security import create_access_token, hash_password


@pytest.fixture
def other_user():
    """Create a second user who does NOT have access to test_project."""
    db = TestSessionLocal()
    user = User(
        email="stranger@plinth.ai",
        hashed_password=hash_password("otherpass123"),
        full_name="Other Architect",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id})
    user_id = user.id
    db.close()
    return {"email": "stranger@plinth.ai", "token": token, "id": user_id}


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
            "area_sqm": 180.5,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def test_list_floors(client, auth_headers, test_project, test_floor):
    pid = test_project["id"]
    response = client.get(f"/api/projects/{pid}/floors", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    floor = next((f for f in data["floors"] if f["id"] == test_floor["id"]), None)
    assert floor is not None
    assert floor["name"] == "Ground Floor"
    assert floor["level_number"] == 0
    assert "rooms" in floor


def test_get_floor(client, auth_headers, test_floor):
    fid = test_floor["id"]
    response = client.get(f"/api/floors/{fid}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == fid
    assert data["name"] == "Ground Floor"
    assert isinstance(data["rooms"], list)


def test_create_room(client, auth_headers, test_floor):
    fid = test_floor["id"]
    payload = {
        "name": "Living Room",
        "type": "living",
        "area_sqm": 42.5,
        "geometry": {
            "x": 4,
            "y": 4,
            "w": 20,
            "h": 15,
            "orientation": "NE",
        },
    }
    response = client.post(f"/api/floors/{fid}/rooms", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Living Room"
    assert data["type"] == "living"
    assert data["area_sqm"] == 42.5
    assert data["geometry"]["x"] == 4
    assert data["geometry"]["orientation"] == "NE"
    assert data["floor_id"] == fid


def test_create_room_alias_route(client, auth_headers, test_floor):
    """Test backward-compatible /projects/{floor_id}/rooms route."""
    fid = test_floor["id"]
    payload = {
        "name": "Dining Room",
        "type": "dining",
        "area_sqm": 25.0,
    }
    response = client.post(f"/api/projects/{fid}/rooms", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Dining Room"


def test_update_room_persists(client, auth_headers, test_floor):
    fid = test_floor["id"]
    # 1. Create room
    create_res = client.post(
        f"/api/floors/{fid}/rooms",
        json={"name": "Bedroom 01", "type": "bedroom", "area_sqm": 30.0},
        headers=auth_headers,
    )
    assert create_res.status_code == 201
    room_id = create_res.json()["id"]

    # 2. Update room with new name, area, and geometry
    patch_payload = {
        "name": "Master Suite",
        "area_sqm": 38.5,
        "geometry": {"x": 10, "y": 12, "w": 25, "h": 18, "orientation": "SE"},
    }
    update_res = client.patch(
        f"/api/rooms/{room_id}",
        json=patch_payload,
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Master Suite"
    assert updated["area_sqm"] == 38.5
    assert updated["geometry"]["orientation"] == "SE"

    # 3. Fetch floor and verify persistence in DB
    floor_res = client.get(f"/api/floors/{fid}", headers=auth_headers)
    assert floor_res.status_code == 200
    rooms = floor_res.json()["rooms"]
    persisted_room = next((r for r in rooms if r["id"] == room_id), None)
    assert persisted_room is not None
    assert persisted_room["name"] == "Master Suite"
    assert persisted_room["area_sqm"] == 38.5
    assert persisted_room["geometry"]["w"] == 25


def test_delete_room_persists(client, auth_headers, test_floor):
    fid = test_floor["id"]
    # 1. Create room
    create_res = client.post(
        f"/api/floors/{fid}/rooms",
        json={"name": "Pantry", "type": "utility", "area_sqm": 8.0},
        headers=auth_headers,
    )
    assert create_res.status_code == 201
    room_id = create_res.json()["id"]

    # 2. Delete room
    del_res = client.delete(f"/api/rooms/{room_id}", headers=auth_headers)
    assert del_res.status_code == 204

    # 3. Verify room is removed from floor
    floor_res = client.get(f"/api/floors/{fid}", headers=auth_headers)
    rooms = floor_res.json()["rooms"]
    assert not any(r["id"] == room_id for r in rooms)

    # 4. Deleting again should return 404
    del_again_res = client.delete(f"/api/rooms/{room_id}", headers=auth_headers)
    assert del_again_res.status_code == 404


def test_room_authorization_isolation(
    client, auth_headers, other_auth_headers, test_project, test_floor
):
    """Verify that users without project membership cannot view, create, edit, or delete rooms."""
    pid = test_project["id"]
    fid = test_floor["id"]

    # 1. Create a room as owner
    create_res = client.post(
        f"/api/floors/{fid}/rooms",
        json={"name": "Owner Office", "type": "office", "area_sqm": 20.0},
        headers=auth_headers,
    )
    assert create_res.status_code == 201
    room_id = create_res.json()["id"]

    # 2. Other user tries to list floors for owner's project -> 403 Forbidden
    res = client.get(f"/api/projects/{pid}/floors", headers=other_auth_headers)
    assert res.status_code == 403

    # 3. Other user tries to get floor -> 403 Forbidden
    res = client.get(f"/api/floors/{fid}", headers=other_auth_headers)
    assert res.status_code == 403

    # 4. Other user tries to create a room on owner's floor -> 403 Forbidden
    res = client.post(
        f"/api/floors/{fid}/rooms",
        json={"name": "Intruder Room", "type": "office"},
        headers=other_auth_headers,
    )
    assert res.status_code == 403

    # 5. Other user tries to update owner's room -> 403 Forbidden
    res = client.patch(
        f"/api/rooms/{room_id}",
        json={"name": "Hacked Room"},
        headers=other_auth_headers,
    )
    assert res.status_code == 403

    # 6. Other user tries to delete owner's room -> 403 Forbidden
    res = client.delete(f"/api/rooms/{room_id}", headers=other_auth_headers)
    assert res.status_code == 403

    # 7. Unauthenticated access -> 403 (HTTPBearer rejection)
    assert client.get(f"/api/floors/{fid}").status_code == 403
    assert client.patch(f"/api/rooms/{room_id}", json={"name": "No Auth"}).status_code == 403
    assert client.delete(f"/api/rooms/{room_id}").status_code == 403


def test_room_nonexistent_references(client, auth_headers):
    # Non-existent floor when creating room
    res = client.post(
        "/api/floors/non-existent-id/rooms",
        json={"name": "Ghost", "type": "other"},
        headers=auth_headers,
    )
    assert res.status_code == 404

    # Non-existent room when updating
    res = client.patch(
        "/api/rooms/non-existent-id",
        json={"name": "Ghost"},
        headers=auth_headers,
    )
    assert res.status_code == 404

    # Non-existent room when deleting
    res = client.delete("/api/rooms/non-existent-id", headers=auth_headers)
    assert res.status_code == 404


def test_import_rooms_batch_endpoint_idempotent(client, auth_headers, test_project, test_floor):
    fid = test_floor["id"]

    batch_payload = {
        "rooms": [
            {
                "name": "Living Zone",
                "type": "living",
                "area_sqm": 25.5,
                "geometry": {
                    "x": 10,
                    "y": 10,
                    "w": 30,
                    "h": 20,
                    "source": "yolo_detector",
                    "detection_id": "det_lz_001",
                    "source_bbox_norm": [0.1, 0.1, 0.4, 0.3],
                    "source_bbox_xyxy": [100, 100, 400, 300],
                },
            },
            {
                "name": "Kitchen Zone",
                "type": "kitchen",
                "area_sqm": 12.0,
                "geometry": {
                    "x": 42,
                    "y": 10,
                    "w": 20,
                    "h": 20,
                    "source": "yolo_detector",
                    "detection_id": "det_kz_002",
                    "source_bbox_norm": [0.42, 0.1, 0.62, 0.3],
                    "source_bbox_xyxy": [420, 100, 620, 300],
                },
            },
        ]
    }

    # First import: both should be created
    res1 = client.post(
        f"/api/floors/{fid}/import-rooms",
        json=batch_payload,
        headers=auth_headers,
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["imported_count"] == 2
    assert data1["updated_count"] == 0
    assert len(data1["rooms"]) == 2

    # Verify floor has 2 rooms
    floor_res = client.get(f"/api/floors/{fid}", headers=auth_headers)
    assert floor_res.status_code == 200
    assert len(floor_res.json()["rooms"]) == 2

    # Second import (repeat submission with identical payload):
    # Idempotent - should update existing rooms without creating duplicates!
    res2 = client.post(
        f"/api/floors/{fid}/import-rooms",
        json=batch_payload,
        headers=auth_headers,
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["imported_count"] == 0
    assert data2["updated_count"] == 2
    assert len(data2["rooms"]) == 2

    # Total rooms on floor must still be 2, NOT 4!
    floor_res2 = client.get(f"/api/floors/{fid}", headers=auth_headers)
    assert floor_res2.status_code == 200
    assert len(floor_res2.json()["rooms"]) == 2


def test_create_room_ai_deduplication(client, auth_headers, test_project, test_floor):
    fid = test_floor["id"]

    room_payload = {
        "name": "Dining Area",
        "type": "dining",
        "area_sqm": 15.0,
        "geometry": {
            "x": 20,
            "y": 20,
            "w": 15,
            "h": 15,
            "source": "yolo_detector",
            "detection_id": "det_da_001",
            "source_bbox_norm": [0.2, 0.2, 0.35, 0.35],
            "source_bbox_xyxy": [200, 200, 350, 350],
        },
    }

    # First POST /rooms
    res1 = client.post(
        f"/api/floors/{fid}/rooms",
        json=room_payload,
        headers=auth_headers,
    )
    assert res1.status_code == 201
    created_id = res1.json()["id"]

    # Second POST /rooms with same AI detection footprint but updated area
    updated_payload = dict(room_payload)
    updated_payload["area_sqm"] = 18.0
    res2 = client.post(
        f"/api/floors/{fid}/rooms",
        json=updated_payload,
        headers=auth_headers,
    )
    assert res2.status_code == 201
    # Must update the existing room ID
    assert res2.json()["id"] == created_id
    assert res2.json()["area_sqm"] == 18.0

    # Total rooms count is 1
    floor_res = client.get(f"/api/floors/{fid}", headers=auth_headers)
    assert len(floor_res.json()["rooms"]) == 1


def test_update_floor_patch_plan_data_and_scale_calibration(client, auth_headers, test_project, test_floor):
    """Test PATCH /api/floors/{id} endpoint updating floor metadata and plan_data scale calibration."""
    fid = test_floor["id"]

    calibration_scale = {
        "isCalibrated": True,
        "metersPerUnit": 0.20,
        "unitsPerMeter": 5.0,
        "realDistanceM": 12.8,
        "canvasUnitsDist": 64.0,
        "pointA": {"x": 4.0, "y": 4.0},
        "pointB": {"x": 68.0, "y": 4.0},
        "ratioString": "1:20",
        "calibratedAt": "2026-10-31T12:00:00.000Z",
    }

    patch_payload = {
        "name": "Calibrated Ground Floor",
        "area_sqm": 195.0,
        "plan_data": {
            "scale": calibration_scale,
            "units": "m",
        },
    }

    # 1. Update floor
    patch_res = client.patch(f"/api/floors/{fid}", json=patch_payload, headers=auth_headers)
    assert patch_res.status_code == 200
    updated_floor = patch_res.json()
    assert updated_floor["name"] == "Calibrated Ground Floor"
    assert updated_floor["area_sqm"] == 195.0
    assert updated_floor["plan_data"] is not None
    assert updated_floor["plan_data"]["scale"]["isCalibrated"] is True
    assert updated_floor["plan_data"]["scale"]["metersPerUnit"] == 0.20
    assert updated_floor["plan_data"]["scale"]["ratioString"] == "1:20"

    # 2. Verify persistence via GET /api/floors/{fid}
    get_res = client.get(f"/api/floors/{fid}", headers=auth_headers)
    assert get_res.status_code == 200
    persisted = get_res.json()
    assert persisted["name"] == "Calibrated Ground Floor"
    assert persisted["plan_data"]["scale"]["realDistanceM"] == 12.8
    assert persisted["plan_data"]["scale"]["canvasUnitsDist"] == 64.0


def test_update_floor_authorization_and_not_found(client, auth_headers, other_auth_headers, test_floor):
    """Test authorization isolation and error handling for PATCH /api/floors/{id}."""
    fid = test_floor["id"]

    # 1. Other unauthorized user cannot PATCH floor -> 403 Forbidden
    other_res = client.patch(
        f"/api/floors/{fid}",
        json={"name": "Hacked Name"},
        headers=other_auth_headers,
    )
    assert other_res.status_code == 403

    # 2. Non-existent floor returns 404
    missing_res = client.patch(
        "/api/floors/00000000-0000-0000-0000-000000000000",
        json={"name": "Ghost Floor"},
        headers=auth_headers,
    )
    assert missing_res.status_code == 404


def test_update_room_geometry_and_calibration_provenance(client, auth_headers, test_floor):
    """Verify room geometry interactive editing and calibrated/manual flags persist."""
    fid = test_floor["id"]

    # 1. Create room
    create_res = client.post(
        f"/api/floors/{fid}/rooms",
        json={
            "name": "Dining Space",
            "type": "dining",
            "area_sqm": 18.0,
            "geometry": {"x": 10, "y": 10, "w": 20, "h": 15, "is_ai_estimate": True},
        },
        headers=auth_headers,
    )
    assert create_res.status_code == 201
    room_id = create_res.json()["id"]

    # 2. Update geometry (e.g. user moved and resized room on canvas, then applied calibrated area)
    update_res = client.patch(
        f"/api/rooms/{room_id}",
        json={
            "name": "Formal Dining Room",
            "area_sqm": 24.0,
            "geometry": {
                "x": 14,
                "y": 12,
                "w": 24,
                "h": 16,
                "is_ai_estimate": False,
                "is_calibrated_calc": True,
                "is_manual": True,
            },
        },
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["name"] == "Formal Dining Room"
    assert data["area_sqm"] == 24.0
    assert data["geometry"]["x"] == 14
    assert data["geometry"]["y"] == 12
    assert data["geometry"]["w"] == 24
    assert data["geometry"]["h"] == 16
    assert data["geometry"]["is_calibrated_calc"] is True
    assert data["geometry"]["is_manual"] is True
    assert data["geometry"]["is_ai_estimate"] is False

