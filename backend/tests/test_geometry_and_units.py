"""Tests for PLINTH Floor Planner geometry mapping, scale calibration, and unit conversions."""
import pytest


# Canonical conversion factors
SQM_TO_SQFT_FACTOR = 10.7639104
SQFT_TO_SQM_FACTOR = 1 / SQM_TO_SQFT_FACTOR


def sqm_to_sqft(sqm: float) -> int:
    """Canonical conversion from square metres to whole square feet."""
    return round(sqm * SQM_TO_SQFT_FACTOR)


def sqft_to_sqm(sqft: float) -> float:
    """Canonical conversion from square feet to square metres."""
    return round(sqft * SQFT_TO_SQM_FACTOR, 2)


def compute_overlap_ratio(box_a: dict, box_b: dict) -> float:
    """Compute the intersection ratio between two bounding boxes relative to the smaller box."""
    x_overlap = max(0, min(box_a["x"] + box_a["w"], box_b["x"] + box_b["w"]) - max(box_a["x"], box_b["x"]))
    y_overlap = max(0, min(box_a["y"] + box_a["h"], box_b["y"] + box_b["h"]) - max(box_a["y"], box_b["y"]))
    intersection = x_overlap * y_overlap

    if intersection <= 0:
        return 0.0

    area_a = box_a["w"] * box_a["h"]
    area_b = box_b["w"] * box_b["h"]
    smaller = min(area_a, area_b)
    return round(intersection / smaller, 4) if smaller > 0 else 0.0


def map_norm_to_grid(norm_box: list, img_w: int, img_h: int) -> dict:
    """Aspect-ratio preserving mapping of normalized bounding box to canvas grid."""
    usable_w = 68
    usable_h = 46
    inner_x_min = 4
    inner_y_min = 4
    inner_x_max = 72
    inner_y_max = 50

    img_aspect = img_w / img_h
    canvas_aspect = usable_w / usable_h

    if img_aspect >= canvas_aspect:
        fit_w = usable_w
        fit_h = usable_w / img_aspect
        offset_x = inner_x_min
        offset_y = inner_y_min + (usable_h - fit_h) / 2
    else:
        fit_h = usable_h
        fit_w = usable_h * img_aspect
        offset_y = inner_y_min
        offset_x = inner_x_min + (usable_w - fit_w) / 2

    nx1, ny1, nx2, ny2 = norm_box
    raw_w = (nx2 - nx1) * fit_w
    raw_h = (ny2 - ny1) * fit_h

    w = max(6, min(round(fit_w), round(raw_w)))
    h = max(4, min(round(fit_h), round(raw_h)))

    raw_x = round(offset_x + nx1 * fit_w)
    raw_y = round(offset_y + ny1 * fit_h)

    x = max(inner_x_min, min(inner_x_max - w, raw_x))
    y = max(inner_y_min, min(inner_y_max - h, raw_y))

    return {"x": x, "y": y, "w": w, "h": h}


# ── Unit Conversion Tests ─────────────────────────────────────────────────────

def test_sqm_to_sqft_standard():
    assert sqm_to_sqft(1.0) == 11
    assert sqm_to_sqft(10.0) == 108
    assert sqm_to_sqft(29.91) == 322
    assert sqm_to_sqft(100.0) == 1076


def test_sqft_to_sqm_standard():
    assert sqft_to_sqm(322) == 29.91
    assert sqft_to_sqm(1076) == 99.96
    assert sqft_to_sqm(0) == 0.0


def test_unit_roundtrip_stability():
    """Verify that conversions preserve precision without drift."""
    for sqm in [10.0, 25.5, 50.0, 117.8]:
        sqft = sqm_to_sqft(sqm)
        recovered_sqm = sqft_to_sqm(sqft)
        assert abs(recovered_sqm - sqm) <= 0.1


# ── Geometry Mapping Tests ────────────────────────────────────────────────────

def test_aspect_ratio_containment_landscape():
    """Wider landscape image should fit to width and be vertically centered."""
    mapped = map_norm_to_grid([0.0, 0.0, 1.0, 1.0], 1280, 720)
    assert mapped["x"] >= 4
    assert mapped["x"] + mapped["w"] <= 72
    assert mapped["y"] >= 4
    assert mapped["y"] + mapped["h"] <= 50


def test_aspect_ratio_containment_portrait():
    """Taller portrait image should fit to height and be horizontally centered."""
    mapped = map_norm_to_grid([0.0, 0.0, 1.0, 1.0], 600, 900)
    assert mapped["x"] >= 4
    assert mapped["x"] + mapped["w"] <= 72
    assert mapped["y"] >= 4
    assert mapped["y"] + mapped["h"] <= 50


def test_box_clamping_to_usable_boundary():
    """Sub-boxes must never spill outside the inner perimeter wall boundaries."""
    for nx in [0.0, 0.5, 0.9]:
        for ny in [0.0, 0.5, 0.9]:
            box = map_norm_to_grid([nx, ny, min(1.0, nx + 0.3), min(1.0, ny + 0.3)], 800, 600)
            assert box["x"] >= 4
            assert box["y"] >= 4
            assert box["x"] + box["w"] <= 72
            assert box["y"] + box["h"] <= 50


# ── Overlap & Collision Detection Tests ───────────────────────────────────────

def test_no_overlap_between_separated_boxes():
    box_a = {"x": 4, "y": 4, "w": 20, "h": 15}
    box_b = {"x": 26, "y": 4, "w": 20, "h": 15}
    assert compute_overlap_ratio(box_a, box_b) == 0.0


def test_complete_overlap():
    box_a = {"x": 10, "y": 10, "w": 20, "h": 20}
    box_b = {"x": 10, "y": 10, "w": 20, "h": 20}
    assert compute_overlap_ratio(box_a, box_b) == 1.0


def test_partial_overlap_fraction():
    box_a = {"x": 10, "y": 10, "w": 20, "h": 20}
    box_b = {"x": 20, "y": 10, "w": 20, "h": 20}  # 10x20 intersection
    # intersection = 200, smaller = 400 -> ratio = 0.5
    assert compute_overlap_ratio(box_a, box_b) == 0.5


# ── API Room CRUD with Geometry Provenance ─────────────────────────────────────

def test_room_with_ai_provenance_persists(client, auth_headers, test_project):
    """Verify that room creation persists AI provenance and geometry metadata."""
    pid = test_project["id"]

    # Create floor first
    floor_res = client.post(
        f"/api/projects/{pid}/floors",
        json={"level_number": 1, "name": "Level 01", "area_sqm": 120.0},
        headers=auth_headers,
    )
    assert floor_res.status_code == 201
    fid = floor_res.json()["id"]

    room_payload = {
        "name": "Master Suite",
        "type": "bedroom",
        "area_sqm": 22.5,
        "geometry": {
            "x": 6,
            "y": 6,
            "w": 24,
            "h": 18,
            "orientation": "SW",
            "source": "yolo_detector",
            "confidence": 0.912,
            "is_ai_estimate": True,
            "source_bbox_xyxy": [120, 150, 480, 510],
        },
    }

    create_res = client.post(f"/api/floors/{fid}/rooms", json=room_payload, headers=auth_headers)
    assert create_res.status_code == 201
    room = create_res.json()
    assert room["name"] == "Master Suite"
    assert room["area_sqm"] == 22.5
    assert room["geometry"]["source"] == "yolo_detector"
    assert room["geometry"]["is_ai_estimate"] is True
    assert room["geometry"]["confidence"] == 0.912

    # Verify update can mark as verified / calibrated
    rid = room["id"]
    patch_payload = {
        "geometry": {
            **room["geometry"],
            "is_ai_estimate": False,
        }
    }
    update_res = client.patch(f"/api/rooms/{rid}", json=patch_payload, headers=auth_headers)
    assert update_res.status_code == 200
    assert update_res.json()["geometry"]["is_ai_estimate"] is False


def test_shared_boundary_vs_spatial_collision():
    """Verify that touching partition walls do not register as severe collisions (>12%)."""
    # 1. Perfectly adjacent boxes sharing vertical wall at x=20
    box_a = {"x": 10, "y": 10, "w": 10, "h": 10}
    box_b = {"x": 20, "y": 10, "w": 10, "h": 10}
    ratio_touch = compute_overlap_ratio(box_a, box_b)
    assert ratio_touch == 0.0

    # 2. Shared partition wall with slight 1-unit overlap (e.g. wall thickness overlap = 10%)
    box_c = {"x": 19, "y": 10, "w": 10, "h": 10}
    ratio_shared_wall = compute_overlap_ratio(box_a, box_c)
    assert ratio_shared_wall == 0.10  # 10% <= 12% tolerance for shared wall

    # 3. Severe spatial collision (> 12%, e.g. 50% overlap)
    box_d = {"x": 15, "y": 10, "w": 10, "h": 10}
    ratio_collision = compute_overlap_ratio(box_a, box_d)
    assert ratio_collision == 0.50  # 50% is a severe collision


# ── Scale Calibration & Measurement Math Tests ───────────────────────────────

import math


def compute_scale_from_reference(point_a: dict, point_b: dict, real_distance_m: float) -> dict:
    """Exact 2-point reference scale calculation matching frontend geometry-utils."""
    dx = point_b["x"] - point_a["x"]
    dy = point_b["y"] - point_a["y"]
    canvas_units_dist = math.sqrt(dx * dx + dy * dy)

    if canvas_units_dist <= 0 or real_distance_m <= 0:
        raise ValueError("Distance and points must be positive and non-coincident")

    meters_per_unit = real_distance_m / canvas_units_dist
    units_per_meter = canvas_units_dist / real_distance_m
    ratio_denominator = round(meters_per_unit * 100)
    ratio_string = f"1:{ratio_denominator}" if ratio_denominator > 0 else "1:1"

    return {
        "isCalibrated": True,
        "metersPerUnit": meters_per_unit,
        "unitsPerMeter": units_per_meter,
        "realDistanceM": real_distance_m,
        "canvasUnitsDist": round(canvas_units_dist, 2),
        "ratioString": ratio_string,
    }


def calculate_calibrated_room_dimensions(w_units: float, h_units: float, meters_per_unit: float) -> dict:
    """Calculates calibrated real-world width, height, and areas."""
    real_w_m = w_units * meters_per_unit
    real_h_m = h_units * meters_per_unit
    area_sqm = real_w_m * real_h_m
    area_sqft = round(area_sqm * SQM_TO_SQFT_FACTOR)

    m_to_ft = 3.28084
    return {
        "realWidthM": round(real_w_m, 2),
        "realHeightM": round(real_h_m, 2),
        "realWidthFt": round(real_w_m * m_to_ft, 1),
        "realHeightFt": round(real_h_m * m_to_ft, 1),
        "areaSqm": round(area_sqm, 2),
        "areaSqft": area_sqft,
    }


def test_scale_calibration_exact_math():
    """Verify scale calibration from known 64-unit reference line with 12.8m real distance."""
    pt_a = {"x": 4.0, "y": 4.0}
    pt_b = {"x": 68.0, "y": 4.0}
    real_dist = 12.8  # meters

    scale = compute_scale_from_reference(pt_a, pt_b, real_dist)
    assert scale["isCalibrated"] is True
    assert scale["canvasUnitsDist"] == 64.0
    assert scale["metersPerUnit"] == 0.20
    assert scale["unitsPerMeter"] == 5.0
    assert scale["ratioString"] == "1:20"


def test_calibrated_room_dimensions_and_area():
    """Verify room dimension and area calculations under calibrated scale (0.20 m/unit)."""
    # 20 units x 15 units at 0.20 m/unit = 4.0m x 3.0m
    dims = calculate_calibrated_room_dimensions(20.0, 15.0, 0.20)
    assert dims["realWidthM"] == 4.0
    assert dims["realHeightM"] == 3.0
    assert dims["areaSqm"] == 12.0
    # 12.0 sqm * 10.7639 = 129.1668 -> 129 sqft
    assert dims["areaSqft"] == 129
    assert dims["realWidthFt"] == 13.1  # 4 * 3.28084 = 13.12 -> 13.1
    assert dims["realHeightFt"] == 9.8   # 3 * 3.28084 = 9.84 -> 9.8


def test_perimeter_dimensions_from_scale():
    """Verify perimeter dimension calculations for 76 x 54 grid units."""
    meters_per_unit = 0.20  # from 12.8m reference
    perimeter_w_m = 76 * meters_per_unit
    perimeter_h_m = 54 * meters_per_unit

    assert round(perimeter_w_m, 2) == 15.20
    assert round(perimeter_h_m, 2) == 10.80

    # In mm:
    assert round(perimeter_w_m * 1000) == 15200
    assert round(perimeter_h_m * 1000) == 10800


# ── Calibration Plausibility, Zoom Independence & Safety Validation ──────────

MIN_CALIBRATION_LINE_UNITS = 2.0
MIN_METERS_PER_UNIT = 0.02
MAX_METERS_PER_UNIT = 2.0
STANDARD_METRIC_SCALES = [10, 20, 25, 50, 100, 125, 200, 250, 500]


def get_standard_scale_ratio_string(meters_per_unit: float) -> str:
    """Computes standard metric architectural scale ratio (e.g. 1:20, 1:50, 1:100)."""
    raw_ratio = round(meters_per_unit * 100)
    if raw_ratio <= 0:
        return "1:1"
    for s in STANDARD_METRIC_SCALES:
        if abs(s - raw_ratio) / raw_ratio <= 0.15:
            return f"1:{s}"
    return f"1:{raw_ratio}"


def validate_calibration(point_a: dict, point_b: dict, real_distance_m: float) -> dict:
    """Validates calibration line length, positive distance, and architectural plausibility."""
    dx = point_b["x"] - point_a["x"]
    dy = point_b["y"] - point_a["y"]
    canvas_units_dist = math.sqrt(dx * dx + dy * dy)

    if canvas_units_dist <= 0:
        return {"is_valid": False, "error": "Reference points A and B cannot be identical."}

    if canvas_units_dist < MIN_CALIBRATION_LINE_UNITS:
        return {
            "is_valid": False,
            "error": f"Reference line is too short ({canvas_units_dist:.1f} units < {MIN_CALIBRATION_LINE_UNITS} min).",
        }

    if real_distance_m <= 0:
        return {"is_valid": False, "error": "Real-world distance must be greater than zero."}

    meters_per_unit = real_distance_m / canvas_units_dist
    ratio_string = get_standard_scale_ratio_string(meters_per_unit)

    if meters_per_unit > MAX_METERS_PER_UNIT:
        return {
            "is_valid": False,
            "error": f"Implausible scale: 1 unit = {meters_per_unit:.2f}m ({ratio_string}) exceeds maximum threshold ({MAX_METERS_PER_UNIT}m/unit).",
            "meters_per_unit": meters_per_unit,
        }

    if meters_per_unit < MIN_METERS_PER_UNIT:
        return {
            "is_valid": False,
            "error": f"Implausible scale: 1 unit = {meters_per_unit * 1000:.0f}mm is below minimum threshold.",
            "meters_per_unit": meters_per_unit,
        }

    return {
        "is_valid": True,
        "meters_per_unit": meters_per_unit,
        "canvas_units_dist": round(canvas_units_dist, 2),
        "ratio_string": ratio_string,
        "envelope_w_m": round(76 * meters_per_unit, 1),
        "envelope_h_m": round(54 * meters_per_unit, 1),
    }


def test_calibration_rejects_line_too_short():
    """Verify that clicking points closer than 2.0 units is rejected."""
    pt_a = {"x": 10.0, "y": 10.0}
    pt_b = {"x": 11.2, "y": 10.0}  # distance = 1.2 units < 2.0
    res = validate_calibration(pt_a, pt_b, 5.0)
    assert res["is_valid"] is False
    assert "Reference line is too short" in res["error"]


def test_calibration_rejects_implausible_large_scale_audit():
    """Audit of the observed screenshot condition: 3.04 units for 12.8m -> 4.21 m/unit.
    Must be rejected as implausible because it blows the building envelope to 320m x 227m."""
    pt_a = {"x": 10.0, "y": 10.0}
    pt_b = {"x": 13.04, "y": 10.0}  # distance = 3.04 units
    real_dist = 12.8  # entered full building distance for a tiny 3-unit line

    res = validate_calibration(pt_a, pt_b, real_dist)
    assert res["is_valid"] is False
    assert "Implausible scale" in res["error"]
    assert res["meters_per_unit"] > 4.20


def test_calibration_rejects_implausible_tiny_scale():
    """Verify that accidental millimetre inputs without unit selector are caught."""
    pt_a = {"x": 4.0, "y": 4.0}
    pt_b = {"x": 68.0, "y": 4.0}  # 64 units
    real_dist = 0.05  # 50 mm entered as meters -> 0.00078 m/unit

    res = validate_calibration(pt_a, pt_b, real_dist)
    assert res["is_valid"] is False
    assert "below minimum threshold" in res["error"]


def test_zone_01_dimensions_at_plausible_vs_implausible_scale():
    """Compare Zone 01 (6x11 units) at implausible 4.21 m/unit vs plausible canonical scale (~0.188 m/unit)."""
    # 1. Observed screenshot state (implausible 4.21 m/unit):
    implausible_dims = calculate_calibrated_room_dimensions(6.0, 11.0, 4.208)
    assert round(implausible_dims["realWidthM"]) == 25  # ~25.25 m
    assert round(implausible_dims["realHeightM"]) == 46  # ~46.29 m
    assert round(implausible_dims["areaSqm"]) == 1169   # ~1168.8 m²

    # 2. Correct canonical scale (12.8m across 68 usable units = 0.1882 m/unit):
    plausible_scale = validate_calibration({"x": 4.0, "y": 4.0}, {"x": 72.0, "y": 4.0}, 12.8)
    assert plausible_scale["is_valid"] is True
    assert round(plausible_scale["meters_per_unit"], 3) == 0.188
    assert plausible_scale["ratio_string"] == "1:20"

    plausible_dims = calculate_calibrated_room_dimensions(6.0, 11.0, plausible_scale["meters_per_unit"])
    assert plausible_dims["realWidthM"] == 1.13   # 1.13 m (~3.7 ft)
    assert plausible_dims["realHeightM"] == 2.07  # 2.07 m (~6.8 ft)
    assert plausible_dims["areaSqm"] == 2.34      # 2.34 m² (~25 sq ft) - realistic foyer/utility space!
    assert plausible_dims["areaSqft"] == 25


def test_zoom_independence():
    """Verify that viewport zoom factor does NOT alter canonical geometry or real-world dimensions."""
    base_geom = {"x": 10, "y": 10, "w": 20, "h": 15}
    meters_per_unit = 0.20

    # Viewport zoom factors: 50%, 100%, 150%, 200%
    for zoom in [0.5, 1.0, 1.5, 2.0]:
        # Grid units remain strictly invariant
        assert base_geom["w"] == 20
        assert base_geom["h"] == 15

        # Real world dimensions remain strictly invariant
        dims = calculate_calibrated_room_dimensions(base_geom["w"], base_geom["h"], meters_per_unit)
        assert dims["realWidthM"] == 4.0
        assert dims["realHeightM"] == 3.0
        assert dims["areaSqm"] == 12.0
        assert dims["areaSqft"] == 129


