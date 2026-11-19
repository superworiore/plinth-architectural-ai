from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import Floor, Room
from schemas.floor import (
    FloorCreate,
    FloorListResponse,
    FloorResponse,
    FloorUpdate,
    RoomBatchImportRequest,
    RoomBatchImportResponse,
    RoomCreate,
    RoomResponse,
    RoomUpdate,
)
from utils.dependencies import check_project_access, get_current_user

router = APIRouter()


@router.get("/projects/{project_id}/floors", response_model=FloorListResponse)
def list_floors(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)
    floors = (
        db.query(Floor)
        .options(selectinload(Floor.rooms))
        .filter(Floor.project_id == project_id)
        .order_by(Floor.level_number.asc())
        .all()
    )
    return FloorListResponse(
        floors=[FloorResponse.model_validate(floor) for floor in floors],
        total=len(floors),
    )


@router.get("/floors/{floor_id}", response_model=FloorResponse)
def get_floor(
    floor_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    floor = (
        db.query(Floor)
        .options(selectinload(Floor.rooms))
        .filter(Floor.id == floor_id)
        .first()
    )
    if floor is None:
        raise HTTPException(status_code=404, detail="Floor not found")
    check_project_access(floor.project_id, current_user, db)
    return FloorResponse.model_validate(floor)


@router.post(
    "/projects/{project_id}/floors",
    response_model=FloorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_floor(
    project_id: str,
    body: FloorCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)
    floor = Floor(
        project_id=project_id,
        level_number=body.level_number,
        name=body.name,
        area_sqm=body.area_sqm,
    )
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return FloorResponse.model_validate(floor)


@router.patch("/floors/{floor_id}", response_model=FloorResponse)
def update_floor(
    floor_id: str,
    body: FloorUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    floor = (
        db.query(Floor)
        .options(selectinload(Floor.rooms))
        .filter(Floor.id == floor_id)
        .first()
    )
    if floor is None:
        raise HTTPException(status_code=404, detail="Floor not found")
    check_project_access(floor.project_id, current_user, db)

    patch_data = body.model_dump(exclude_unset=True)
    for field, val in patch_data.items():
        setattr(floor, field, val)

    db.commit()
    db.refresh(floor)
    return FloorResponse.model_validate(floor)


def is_same_detection_geometry(geom_a: dict | None, geom_b: dict | None) -> bool:
    """Check if two room geometries represent the exact same YOLO AI detection."""
    if not geom_a or not geom_b:
        return False

    # 1. Direct detection ID match
    id_a = geom_a.get("detection_id")
    id_b = geom_b.get("detection_id")
    if id_a and id_b and id_a == id_b:
        return True

    # Check that both are YOLO detector outputs
    src_a = geom_a.get("source")
    src_b = geom_b.get("source")
    if src_a not in ("yolo_detector", "yolo_detection") and src_b not in ("yolo_detector", "yolo_detection"):
        return False

    # 2. Normalized bbox match within 0.012 tolerance
    norm_a = geom_a.get("source_bbox_norm")
    norm_b = geom_b.get("source_bbox_norm")
    if (
        isinstance(norm_a, (list, tuple))
        and isinstance(norm_b, (list, tuple))
        and len(norm_a) == 4
        and len(norm_b) == 4
    ):
        if all(abs(norm_a[i] - norm_b[i]) <= 0.012 for i in range(4)):
            return True

    # 3. Pixel bbox match within 6px tolerance
    xy_a = geom_a.get("source_bbox_xyxy")
    xy_b = geom_b.get("source_bbox_xyxy")
    if (
        isinstance(xy_a, (list, tuple))
        and isinstance(xy_b, (list, tuple))
        and len(xy_a) == 4
        and len(xy_b) == 4
    ):
        if all(abs(xy_a[i] - xy_b[i]) <= 6 for i in range(4)):
            return True

    return False


@router.post(
    "/floors/{floor_id}/rooms",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/projects/{floor_id}/rooms",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_room(
    floor_id: str,
    body: RoomCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if floor is None:
        raise HTTPException(status_code=404, detail="Floor not found")
    check_project_access(floor.project_id, current_user, db)

    # Idempotency / deduplication guard for AI-imported rooms
    if body.geometry and body.geometry.get("source") in ("yolo_detector", "yolo_detection"):
        existing_rooms = db.query(Room).filter(Room.floor_id == floor.id).all()
        for existing in existing_rooms:
            if is_same_detection_geometry(existing.geometry, body.geometry):
                # Update existing room if new calibration area/type was provided, then return it
                if body.area_sqm is not None:
                    existing.area_sqm = body.area_sqm
                if body.type:
                    existing.type = body.type
                if body.geometry:
                    existing.geometry = body.geometry
                db.commit()
                db.refresh(existing)
                return RoomResponse.model_validate(existing)

    room = Room(
        floor_id=floor.id,
        name=body.name,
        type=body.type,
        area_sqm=body.area_sqm,
        geometry=body.geometry,
        materials=body.materials,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return RoomResponse.model_validate(room)


@router.post(
    "/floors/{floor_id}/import-rooms",
    response_model=RoomBatchImportResponse,
    status_code=status.HTTP_200_OK,
)
def import_rooms(
    floor_id: str,
    body: RoomBatchImportRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Batch-import room detections into a floor with duplicate prevention and idempotency."""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if floor is None:
        raise HTTPException(status_code=404, detail="Floor not found")
    check_project_access(floor.project_id, current_user, db)

    existing_rooms = db.query(Room).filter(Room.floor_id == floor.id).all()
    imported_count = 0
    updated_count = 0
    result_rooms = []

    for room_in in body.rooms:
        matched_room = None
        if room_in.geometry and room_in.geometry.get("source") in ("yolo_detector", "yolo_detection"):
            for existing in existing_rooms:
                if is_same_detection_geometry(existing.geometry, room_in.geometry):
                    matched_room = existing
                    break

        if matched_room:
            # Idempotently update existing room
            if room_in.area_sqm is not None:
                matched_room.area_sqm = room_in.area_sqm
            if room_in.type:
                matched_room.type = room_in.type
            if room_in.geometry:
                matched_room.geometry = room_in.geometry
            if room_in.name and not matched_room.name:
                matched_room.name = room_in.name
            updated_count += 1
            result_rooms.append(matched_room)
        else:
            new_room = Room(
                floor_id=floor.id,
                name=room_in.name,
                type=room_in.type,
                area_sqm=room_in.area_sqm,
                geometry=room_in.geometry,
                materials=room_in.materials,
            )
            db.add(new_room)
            existing_rooms.append(new_room)
            imported_count += 1
            result_rooms.append(new_room)

    db.commit()
    for r in result_rooms:
        db.refresh(r)

    return RoomBatchImportResponse(
        imported_count=imported_count,
        updated_count=updated_count,
        rooms=[RoomResponse.model_validate(r) for r in result_rooms],
    )




@router.patch("/rooms/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: str,
    body: RoomUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    floor = db.query(Floor).filter(Floor.id == room.floor_id).first()
    if floor is None:
        raise HTTPException(status_code=404, detail="Floor not found")
    check_project_access(floor.project_id, current_user, db)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return RoomResponse.model_validate(room)


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    floor = db.query(Floor).filter(Floor.id == room.floor_id).first()
    if floor is None:
        raise HTTPException(status_code=404, detail="Floor not found")
    check_project_access(floor.project_id, current_user, db)
    db.delete(room)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
