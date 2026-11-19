/**
 * Milestone Verification Test Suite
 * Tests measurement status consistency, calibration validation, scale calculations,
 * unit conversions, and resolution precedence.
 */
import assert from "node:assert";
import {
  resolveMeasurementStatus,
  getMeasurementStatusInfo,
  estimateRoomAreaSqm,
  getStandardScaleRatioString,
  isScaleCalibrationPlausible,
  validateCalibrationScale,
  computeScaleFromReference,
  calculateCalibratedRoomDimensions,
  sqmToSqft,
  sqftToSqm,
  findMatchingExistingRoom,
  generateDetectionFingerprint,
  convertDistanceToMeters,
  convertMetersToUnit,
  calculateFloorAreaBreakdown,
  validateRoomBoundaries,
} from "../src/lib/geometry-utils";

function testMeasurementStatusResolution() {
  console.log("▶ Testing Measurement Status Resolution & Consistency...");

  // 1. Raw YOLO detection with is_ai_estimate = false (legacy DB state from proportional split)
  const legacyZone04 = {
    source: "yolo_detector",
    confidence: 0.4736,
    is_ai_estimate: false,
    calibration_floor_area_sqm: 118,
  };
  const status1 = resolveMeasurementStatus(legacyZone04);
  assert.strictEqual(
    status1,
    "ai_estimate",
    "Legacy YOLO room with is_ai_estimate:false must resolve to 'ai_estimate'"
  );

  // 2. User corrected room
  const userCorrectedRoom = {
    source: "manual",
    is_manual: true,
    is_ai_estimate: false,
  };
  const status2 = resolveMeasurementStatus(userCorrectedRoom);
  assert.strictEqual(status2, "user_corrected", "Manually modified room must resolve to 'user_corrected'");

  // 3. User verified room via flag
  const verifiedRoom = {
    source: "yolo_detector",
    is_ai_estimate: false,
    measurement_status: "user_corrected",
  };
  const status3 = resolveMeasurementStatus(verifiedRoom);
  assert.strictEqual(status3, "user_corrected", "Room marked user_corrected must resolve to 'user_corrected'");

  // 4. Real scale calibrated room
  const calibratedRoom = {
    source: "calibrated_scale",
    is_calibrated_calc: true,
    is_ai_estimate: false,
    measurement_status: "calibrated",
    calibrated_meters_per_unit: 0.188,
  };
  const status4 = resolveMeasurementStatus(calibratedRoom);
  assert.strictEqual(status4, "calibrated", "Scale-calculated room must resolve to 'calibrated'");

  // 5. Precedence: explicit measurement_status overrides ambiguous flags
  const explicitPrecedence = {
    is_ai_estimate: true,
    measurement_status: "calibrated",
  };
  const status5 = resolveMeasurementStatus(explicitPrecedence);
  assert.strictEqual(status5, "calibrated", "Explicit measurement_status takes precedence");

  console.log("  ✓ Status resolution respects single authoritative model across all 5 test cases.");
}

function testMeasurementStatusInfo() {
  console.log("▶ Testing Measurement Status Display Info...");

  const aiEstInfo = getMeasurementStatusInfo("ai_estimate");
  assert.strictEqual(aiEstInfo.label, "AI Estimate");
  assert.strictEqual(aiEstInfo.badgeText, "AI Estimate");
  assert.ok(aiEstInfo.badgeClass.includes("amber"));

  const userCorrInfo = getMeasurementStatusInfo("user_corrected");
  assert.strictEqual(userCorrInfo.label, "User Corrected");
  assert.ok(userCorrInfo.badgeClass.includes("blue"));

  const calibInfo = getMeasurementStatusInfo("calibrated");
  assert.strictEqual(calibInfo.label, "Calibrated");
  assert.ok(calibInfo.badgeText.includes("Calibrated"));
  assert.ok(calibInfo.badgeClass.includes("emerald"));

  console.log("  ✓ Status display metadata properly configured for all statuses.");
}

function testProportionalAreaEstimationIsNotCalibrated() {
  console.log("▶ Testing Proportional Area Estimation...");

  // When a total floor area (e.g. 118 m²) is supplied, it's a proportional estimate heuristic,
  // NOT a real scale calibration.
  const result = estimateRoomAreaSqm(6, 6, 118, 928);
  assert.strictEqual(
    result.isCalibrated,
    false,
    "estimateRoomAreaSqm with total floor area must NOT claim isCalibrated: true"
  );
  assert.strictEqual(result.isProportionalEstimate, true);
  assert.strictEqual(result.areaSqm, 4.6);

  console.log("  ✓ Proportional area estimation correctly marked uncalibrated estimate (isCalibrated: false).");
}

function testScaleCalibrationMathAndValidation() {
  console.log("▶ Testing Scale Calibration Math & Boundaries...");

  // Realistic calibration across building width (68 canvas units for 12.8m)
  const pointA = { x: 4, y: 10 };
  const pointB = { x: 72, y: 10 };
  const realDistanceM = 12.8;

  const validation = validateCalibrationScale(pointA, pointB, realDistanceM);
  assert.strictEqual(validation.isValid, true);
  assert.strictEqual(validation.isPlausible, true);
  assert.strictEqual(validation.canvasUnitsDist, 68);
  assert.strictEqual(Math.round(validation.metersPerUnit * 1000) / 1000, 0.188);
  assert.strictEqual(validation.ratioString, "1:20");

  // Calibrate scale
  const scale = computeScaleFromReference(pointA, pointB, realDistanceM);
  assert.strictEqual(scale.isCalibrated, true);
  assert.strictEqual(scale.ratioString, "1:20");

  // Room dimensions for Zone 01 (6 x 11 units)
  const roomDims = calculateCalibratedRoomDimensions(6, 11, scale.metersPerUnit);
  assert.strictEqual(roomDims.widthM, 1.13);
  assert.strictEqual(roomDims.heightM, 2.07);
  assert.strictEqual(roomDims.areaSqm, 2.3);
  assert.strictEqual(roomDims.areaSqft, 25);
  assert.strictEqual(roomDims.isPlausible, true);

  // Test implausible oversized scale (4.209 m/unit from entering 12.8m on a 3.04 unit line)
  const shortLineA = { x: 67.5, y: 15 };
  const shortLineB = { x: 70.5, y: 14.5 };
  const badValidation = validateCalibrationScale(shortLineA, shortLineB, 12.8);
  assert.strictEqual(badValidation.isValid, false, "Scale of 4.21m/unit must be rejected as implausible");
  assert.strictEqual(badValidation.isPlausible, false);
  assert.ok(badValidation.error?.includes("Implausible scale"));

  // Check scale ratio string for 4.209 m/unit
  const ratioString = getStandardScaleRatioString(4.2086);
  assert.strictEqual(ratioString, "1:421");
  assert.strictEqual(isScaleCalibrationPlausible(4.2086), false);
  assert.strictEqual(isScaleCalibrationPlausible(0.188), true);

  console.log("  ✓ Scale calibration mathematics, architectural ratio conversion, and bounds verified.");
}

function testUnitConversions() {
  console.log("▶ Testing Unit Conversions...");

  assert.strictEqual(sqmToSqft(10), 108);
  assert.strictEqual(sqmToSqft(20), 215);
  assert.strictEqual(sqmToSqft(118), 1270);
  assert.strictEqual(Math.round(sqftToSqm(1076)), 100);

  // Roundtrip
  const originalSqm = 50;
  const sqft = sqmToSqft(originalSqm);
  const roundtrip = sqftToSqm(sqft);
  assert.ok(Math.abs(roundtrip - originalSqm) <= 0.5, "Roundtrip within 0.5m² tolerance");

  console.log("  ✓ Square metre / square foot conversions verified.");
}

function testDeduplicationAndRoomMatching() {
  console.log("▶ Testing Detection Matching & Deduplication...");

  const existingRooms = [
    {
      id: "room-1",
      name: "Zone 01",
      geometry: {
        source: "yolo_detector",
        detection_id: "det_954_146_1000_384",
        source_bbox_norm: [0.954, 0.1458, 1.0, 0.384],
        source_bbox_xyxy: [1242.15, 168.39, 1302.0, 443.53],
      },
    },
  ];

  // Match by detection_id fingerprint
  const match = findMatchingExistingRoom(
    [0.954, 0.1458, 1.0, 0.384],
    [1242.15, 168.39, 1302.0, 443.53],
    existingRooms
  );
  assert.strictEqual(match.isAlreadyImported, true);
  assert.strictEqual(match.existingRoom?.name, "Zone 01");

  // Non-matching new detection
  const noMatch = findMatchingExistingRoom(
    [0.1, 0.1, 0.3, 0.3],
    [100, 100, 300, 300],
    existingRooms
  );
  assert.strictEqual(noMatch.isAlreadyImported, false);

  console.log("  ✓ Room matching and deduplication verified.");
}

function testMultiUnitConversions() {
  console.log("▶ Testing Multi-Unit Distance Conversions (mm, cm, m, ft)...");

  assert.strictEqual(convertDistanceToMeters(5000, "mm"), 5.0);
  assert.strictEqual(convertDistanceToMeters(500, "cm"), 5.0);
  assert.strictEqual(convertDistanceToMeters(5, "m"), 5.0);
  assert.strictEqual(Math.round(convertDistanceToMeters(16.4042, "ft") * 10) / 10, 5.0);

  // Negative or invalid returns 0
  assert.strictEqual(convertDistanceToMeters(-10, "m"), 0);

  // Conversion from meters to display units
  assert.strictEqual(convertMetersToUnit(5.0, "mm"), 5000);
  assert.strictEqual(convertMetersToUnit(5.0, "cm"), 500);
  assert.strictEqual(convertMetersToUnit(5.0, "m"), 5.0);
  assert.strictEqual(convertMetersToUnit(5.0, "ft"), 16.4);

  console.log("  ✓ Multi-unit distance conversions verified.");
}

function testFloorAreaBreakdown() {
  console.log("▶ Testing Architectural Floor Area Breakdown (7 Values)...");

  const rooms = [
    { area_sqm: 15.6, measurementStatus: "ai_estimate" as const },
    { area_sqm: 15.6, measurementStatus: "ai_estimate" as const },
    { area_sqm: 28.4, measurementStatus: "user_corrected" as const },
    { area_sqm: 8.5, measurementStatus: "calibrated" as const },
    { area_sqm: 5.7, measurementStatus: "calibrated" as const },
  ];
  // Rooms sum = 73.8 m²
  // Floor area = 100.0 m²
  // Unallocated = 26.2 m²
  const breakdown = calculateFloorAreaBreakdown(100.0, rooms);

  assert.strictEqual(breakdown.floorAreaSqm, 100.0);
  assert.strictEqual(breakdown.roomsTotalAreaSqm, 73.8);
  assert.strictEqual(breakdown.unallocatedAreaSqm, 26.2);
  assert.strictEqual(breakdown.allocatedPct, 74);
  assert.strictEqual(breakdown.unallocatedPct, 26);
  assert.strictEqual(breakdown.aiEstimateCount, 2);
  assert.strictEqual(breakdown.aiEstimateAreaSqm, 31.2);
  assert.strictEqual(breakdown.userCorrectedCount, 1);
  assert.strictEqual(breakdown.userCorrectedAreaSqm, 28.4);
  assert.strictEqual(breakdown.calibratedCount, 2);
  assert.strictEqual(breakdown.calibratedAreaSqm, 14.2);

  console.log("  ✓ Architectural floor area breakdown verified.");
}

function testBoundaryEnvelopeValidation() {
  console.log("▶ Testing Boundary Envelope Validation...");

  // Room inside envelope (usable bounds [4, 72] x [4, 50])
  const inside = validateRoomBoundaries({ x: 10, y: 10, w: 15, h: 12 });
  assert.strictEqual(inside.isOutOfBounds, false);
  assert.strictEqual(inside.violations.length, 0);

  // Room crossing west envelope (x = 2 < 4)
  const westCross = validateRoomBoundaries({ x: 2, y: 10, w: 15, h: 12 });
  assert.strictEqual(westCross.isOutOfBounds, true);
  assert.ok(westCross.violations.some((v) => v.includes("west envelope")));

  // Room crossing east envelope (x + w = 75 > 72)
  const eastCross = validateRoomBoundaries({ x: 60, y: 10, w: 15, h: 12 });
  assert.strictEqual(eastCross.isOutOfBounds, true);
  assert.ok(eastCross.violations.some((v) => v.includes("east envelope")));

  console.log("  ✓ Boundary envelope validation verified.");
}

console.log("==================================================");
console.log("PLINTH Floor Planner — Milestone Verification Test");
console.log("==================================================");

testMeasurementStatusResolution();
testMeasurementStatusInfo();
testProportionalAreaEstimationIsNotCalibrated();
testScaleCalibrationMathAndValidation();
testUnitConversions();
testMultiUnitConversions();
testFloorAreaBreakdown();
testBoundaryEnvelopeValidation();
testDeduplicationAndRoomMatching();

console.log("\n==================================================");
console.log("ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ✓");
console.log("==================================================");
