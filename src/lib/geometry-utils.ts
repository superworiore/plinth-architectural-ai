/**
 * PLINTH Geometry & Unit Conversion Utilities
 *
 * Provides deterministic coordinate transformations from YOLO normalized bounding boxes
 * to architectural floor-plan canvas units, overlap detection, scale calibration,
 * and standard unit conversions (square metres <-> square feet).
 */

// ── Canonical Unit Constants ──────────────────────────────────────────────────
// 1 international square metre = 10.76391041671 square feet
export const SQM_TO_SQFT_FACTOR = 10.7639104;
export const SQFT_TO_SQM_FACTOR = 1 / SQM_TO_SQFT_FACTOR;

/** Convert square metres to whole square feet (standard architectural display). */
export function sqmToSqft(sqm: number): number {
  if (!Number.isFinite(sqm) || sqm < 0) return 0;
  return Math.round(sqm * SQM_TO_SQFT_FACTOR);
}

/** Convert square feet to square metres with 2 decimal places. */
export function sqftToSqm(sqft: number): number {
  if (!Number.isFinite(sqft) || sqft < 0) return 0;
  return Math.round(sqft * SQFT_TO_SQM_FACTOR * 100) / 100;
}

// ── Canvas Grid Dimensions & Usable Boundaries ────────────────────────────────
// The FloorPlan canvas represents a building envelope of 12.8m x 9.2m (117.76 m²)
// Outer perimeter wall occupies 76 units wide by 54 units high.
export const CANVAS_GRID = {
  OUTER_WIDTH: 76,
  OUTER_HEIGHT: 54,
  INNER_X_MIN: 4,
  INNER_Y_MIN: 4,
  INNER_X_MAX: 72,
  INNER_Y_MAX: 50,
  USABLE_WIDTH: 68,  // 72 - 4
  USABLE_HEIGHT: 46, // 50 - 4
  // Real world dimensions (mm & m)
  REAL_WIDTH_M: 12.8,
  REAL_HEIGHT_M: 9.2,
  TOTAL_ENVELOPE_SQM: 12.8 * 9.2, // 117.76 m²
};

export interface NormalizedBox {
  norm_x1: number;
  norm_y1: number;
  norm_x2: number;
  norm_y2: number;
}

export interface CanvasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasMappingResult extends CanvasRect {
  aspectRatio: number;
  fitScaleX: number;
  fitScaleY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Maps a normalized detection bounding box [0..1] into the inner architectural
 * canvas grid, preserving the source image aspect ratio ("contain" fit).
 */
export function mapBboxToCanvas(
  bboxNorm: [number, number, number, number],
  imageWidth: number,
  imageHeight: number
): CanvasMappingResult {
  const safeImgW = Math.max(1, imageWidth || 640);
  const safeImgH = Math.max(1, imageHeight || 640);
  const imgAspect = safeImgW / safeImgH;
  const canvasAspect = CANVAS_GRID.USABLE_WIDTH / CANVAS_GRID.USABLE_HEIGHT; // ~1.478

  let fitWidth: number;
  let fitHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (imgAspect >= canvasAspect) {
    // Image is wider than canvas usable area -> fit to width, letterbox vertically
    fitWidth = CANVAS_GRID.USABLE_WIDTH;
    fitHeight = CANVAS_GRID.USABLE_WIDTH / imgAspect;
    offsetX = CANVAS_GRID.INNER_X_MIN;
    offsetY = CANVAS_GRID.INNER_Y_MIN + (CANVAS_GRID.USABLE_HEIGHT - fitHeight) / 2;
  } else {
    // Image is taller than canvas usable area -> fit to height, pillarbox horizontally
    fitHeight = CANVAS_GRID.USABLE_HEIGHT;
    fitWidth = CANVAS_GRID.USABLE_HEIGHT * imgAspect;
    offsetY = CANVAS_GRID.INNER_Y_MIN;
    offsetX = CANVAS_GRID.INNER_X_MIN + (CANVAS_GRID.USABLE_WIDTH - fitWidth) / 2;
  }

  const [nx1, ny1, nx2, ny2] = bboxNorm;
  const clampNormX1 = Math.max(0, Math.min(1, nx1));
  const clampNormY1 = Math.max(0, Math.min(1, ny1));
  const clampNormX2 = Math.max(clampNormX1 + 0.02, Math.min(1, nx2));
  const clampNormY2 = Math.max(clampNormY1 + 0.02, Math.min(1, ny2));

  const rawW = (clampNormX2 - clampNormX1) * fitWidth;
  const rawH = (clampNormY2 - clampNormY1) * fitHeight;

  // Minimum dimensions: at least 6 units wide, 4 units high
  const w = Math.max(6, Math.min(Math.round(fitWidth), Math.round(rawW)));
  const h = Math.max(4, Math.min(Math.round(fitHeight), Math.round(rawH)));

  // Calculate top-left position and clamp to usable boundary
  const rawX = Math.round(offsetX + clampNormX1 * fitWidth);
  const rawY = Math.round(offsetY + clampNormY1 * fitHeight);

  const x = Math.max(CANVAS_GRID.INNER_X_MIN, Math.min(CANVAS_GRID.INNER_X_MAX - w, rawX));
  const y = Math.max(CANVAS_GRID.INNER_Y_MIN, Math.min(CANVAS_GRID.INNER_Y_MAX - h, rawY));

  return {
    x,
    y,
    w,
    h,
    aspectRatio: imgAspect,
    fitScaleX: fitWidth,
    fitScaleY: fitHeight,
    offsetX,
    offsetY,
  };
}

// ── Overlap & Collision Detection ─────────────────────────────────────────────

export interface OverlapInfo {
  hasOverlap: boolean;
  overlappingIndex: number | null;
  overlapPercentage: number; // 0 to 100
  overlapDetails: string;
}

/**
 * Checks if two canvas rectangles overlap and calculates the intersection percentage
 * relative to the smaller rectangle.
 * Distinguishes between shared partition wall boundaries (<= 12% or edge penetration <= 1 unit)
 * and significant spatial collisions (> 12%).
 */
export function computeBoxOverlap(a: CanvasRect, b: CanvasRect): {
  isOverlapping: boolean;
  isSharedBoundary: boolean;
  ratio: number;
} {
  const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const intersectionArea = xOverlap * yOverlap;

  if (intersectionArea <= 0) {
    return { isOverlapping: false, isSharedBoundary: false, ratio: 0 };
  }

  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  const smallerArea = Math.min(areaA, areaB);

  const ratio = smallerArea > 0 ? intersectionArea / smallerArea : 0;
  const roundedRatio = Math.min(1, Math.round(ratio * 100) / 100);

  // In architectural floor plans, touching partition walls can overlap by 1 grid unit or <= 12%
  const isShared = roundedRatio <= 0.12 || xOverlap <= 1 || yOverlap <= 1;

  return {
    isOverlapping: roundedRatio > 0.05,
    isSharedBoundary: isShared,
    ratio: roundedRatio,
  };
}


/**
 * Finds all pairwise overlaps among a list of rectangles.
 * Returns a map of index -> list of overlap descriptors.
 */
export function detectAllOverlaps(
  boxes: CanvasRect[]
): Map<number, { targetIndex: number; ratio: number; isSharedBoundary: boolean }[]> {
  const overlapMap = new Map<number, { targetIndex: number; ratio: number; isSharedBoundary: boolean }[]>();

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const boxA = boxes[i];
      const boxB = boxes[j];
      if (!boxA || !boxB) continue;
      const { isOverlapping, isSharedBoundary, ratio } = computeBoxOverlap(boxA, boxB);
      if (isOverlapping) {
        if (!overlapMap.has(i)) overlapMap.set(i, []);
        if (!overlapMap.has(j)) overlapMap.set(j, []);
        overlapMap.get(i)!.push({ targetIndex: j, ratio, isSharedBoundary });
        overlapMap.get(j)!.push({ targetIndex: i, ratio, isSharedBoundary });
      }
    }
  }

  return overlapMap;
}

/**
 * Smart separation helper: Nudges overlapping rectangles apart so they become adjacent
 * instead of intersecting, keeping them within canvas boundaries.
 */
export function separateOverlappingBoxes<T extends CanvasRect>(boxes: T[]): T[] {
  const adjusted = boxes.map((b) => ({ ...b }));

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < adjusted.length; i++) {
      for (let j = i + 1; j < adjusted.length; j++) {
        const a = adjusted[i]!;
        const b = adjusted[j]!;

        const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

        if (xOverlap > 0 && yOverlap > 0) {
          // Resolve along the axis with the smaller penetration depth
          if (xOverlap < yOverlap) {
            const shift = Math.ceil(xOverlap / 2);
            if (a.x < b.x) {
              a.x = Math.max(CANVAS_GRID.INNER_X_MIN, a.x - shift);
              b.x = Math.min(CANVAS_GRID.INNER_X_MAX - b.w, b.x + shift);
            } else {
              b.x = Math.max(CANVAS_GRID.INNER_X_MIN, b.x - shift);
              a.x = Math.min(CANVAS_GRID.INNER_X_MAX - a.w, a.x + shift);
            }
          } else {
            const shift = Math.ceil(yOverlap / 2);
            if (a.y < b.y) {
              a.y = Math.max(CANVAS_GRID.INNER_Y_MIN, a.y - shift);
              b.y = Math.min(CANVAS_GRID.INNER_Y_MAX - b.h, b.y + shift);
            } else {
              b.y = Math.max(CANVAS_GRID.INNER_Y_MIN, b.y - shift);
              a.y = Math.min(CANVAS_GRID.INNER_Y_MAX - a.h, a.y + shift);
            }
          }
        }
      }
    }
  }

  return adjusted;
}

// ── Measurement Status & Provenance Model ──────────────────────────────────

export type MeasurementStatus = "ai_estimate" | "user_corrected" | "calibrated";

export interface MeasurementStatusInfo {
  status: MeasurementStatus;
  label: string;
  badgeText: string;
  shortBadge: string;
  description: string;
  badgeClass: string;
}

/**
 * Returns UI display metadata for a canonical measurement status.
 */
export function getMeasurementStatusInfo(status: MeasurementStatus): MeasurementStatusInfo {
  switch (status) {
    case "calibrated":
      return {
        status: "calibrated",
        label: "Calibrated",
        badgeText: "✓ Calibrated",
        shortBadge: "Calibrated",
        description: "Computed from verified scale calibration and room boundaries.",
        badgeClass: "text-emerald-700 bg-emerald-500/15 border-emerald-500/30",
      };
    case "user_corrected":
      return {
        status: "user_corrected",
        label: "User Corrected",
        badgeText: "User Corrected",
        shortBadge: "User Corr",
        description: "Manually entered, adjusted, or verified by architect.",
        badgeClass: "text-blue-700 bg-blue-500/15 border-blue-500/30",
      };
    case "ai_estimate":
    default:
      return {
        status: "ai_estimate",
        label: "AI Estimate",
        badgeText: "AI Estimate",
        shortBadge: "AI Est",
        description: "Derived from visual detection bounding box (uncalibrated estimate).",
        badgeClass: "text-amber-700 bg-amber-500/15 border-amber-500/30",
      };
  }
}

/**
 * Authoritative resolver for room measurement status.
 * Single source of truth across all floor planner components.
 */
export function resolveMeasurementStatus(
  geom?: Record<string, unknown> | null,
  flags?: { isEstimate?: boolean; isCalibratedCalc?: boolean; isManual?: boolean }
): MeasurementStatus {
  // 1. Explicit canonical measurement_status attribute takes highest precedence
  const explicit = geom ? (geom["measurement_status"] as string | undefined) : undefined;
  if (explicit === "calibrated" || explicit === "user_corrected" || explicit === "ai_estimate") {
    return explicit;
  }

  // 2. Calibrated calculation flag (room area was derived via scale calibration)
  if ((geom && geom["is_calibrated_calc"] === true) || flags?.isCalibratedCalc === true) {
    return "calibrated";
  }

  // 3. User corrected / manual flag
  if ((geom && geom["is_manual"] === true) || flags?.isManual === true) {
    return "user_corrected";
  }

  // 4. If geometry has is_ai_estimate === false AND NOT yolo_detector, it was manually verified
  if (geom && geom["is_ai_estimate"] === false && geom["source"] !== "yolo_detector") {
    return "user_corrected";
  }

  // 5. Default: AI estimate (YOLO detections, uncalibrated auto-layout)
  return "ai_estimate";
}

// ── Area Estimation & Scale Calibration ────────────────────────────────────────

/**
 * Calculates estimated room area in m² based on grid dimensions.
 *
 * If calibrationAreaSqm is supplied (e.g. known floor area), rooms receive an area
 * proportional to their grid area relative to total usable grid area.
 * Otherwise, the canonical envelope grid factor (1 unit ≈ 0.1684m x 0.1704m = 0.0287m²) is used.
 * Note: Proportional distribution is an area estimate, NOT a real scale calibration.
 */
export function estimateRoomAreaSqm(
  w: number,
  h: number,
  calibrationAreaSqm?: number | null,
  totalGridUnitsArea?: number | null
): { areaSqm: number; isCalibrated: boolean; isProportionalEstimate: boolean } {
  const boxUnits = w * h;

  if (calibrationAreaSqm && calibrationAreaSqm > 0 && totalGridUnitsArea && totalGridUnitsArea > 0) {
    const fraction = boxUnits / totalGridUnitsArea;
    const estimated = Math.round(fraction * calibrationAreaSqm * 10) / 10;
    return {
      areaSqm: Math.max(1, estimated),
      isCalibrated: false,
      isProportionalEstimate: true,
    };
  }

  // Envelope unit factor: 1 unit ~ 0.1684m x 0.1704m = 0.0287 m²
  const uncalibrated = Math.round(boxUnits * 0.0287 * 10) / 10;
  return {
    areaSqm: Math.max(2, uncalibrated),
    isCalibrated: false,
    isProportionalEstimate: false,
  };
}

// ── Detection Fingerprint & Idempotency Deduplication Helpers ─────────────────

/**
 * Generates a deterministic fingerprint for a normalized detection bounding box.
 */
export function generateDetectionFingerprint(bboxNorm: [number, number, number, number]): string {
  const [nx1, ny1, nx2, ny2] = bboxNorm;
  return `det_${Math.round(nx1 * 1000)}_${Math.round(ny1 * 1000)}_${Math.round(nx2 * 1000)}_${Math.round(ny2 * 1000)}`;
}

export interface ExistingRoomLike {
  id: string;
  name: string;
  geometry?: Record<string, unknown> | null;
}

/**
 * Checks whether an incoming detection geometry already matches an existing room on this floor.
 * Matches by explicit detection_id, matching source_bbox_norm (within tolerance),
 * or matching source_bbox_xyxy (within pixel tolerance).
 * Does NOT rely on room names alone.
 */
export function isSameDetection(
  geomA?: Record<string, unknown> | null,
  geomB?: Record<string, unknown> | null
): boolean {
  if (!geomA || !geomB) return false;

  // 1. Explicit detection ID match
  const idA = geomA["detection_id"] as string | undefined;
  const idB = geomB["detection_id"] as string | undefined;
  if (idA && idB && idA === idB) {
    return true;
  }

  // Only compare detections originating from YOLO
  const srcA = geomA["source"] as string | undefined;
  const srcB = geomB["source"] as string | undefined;
  if (
    srcA !== "yolo_detector" &&
    srcA !== "yolo_detection" &&
    srcB !== "yolo_detector" &&
    srcB !== "yolo_detection"
  ) {
    return false;
  }

  // 2. Normalized bounding box match within 0.012 tolerance
  const normA = geomA["source_bbox_norm"] as [number, number, number, number] | undefined;
  const normB = geomB["source_bbox_norm"] as [number, number, number, number] | undefined;
  if (Array.isArray(normA) && Array.isArray(normB) && normA.length === 4 && normB.length === 4) {
    const isNormMatch = normA.every((val, idx) => Math.abs(val - normB[idx]!) <= 0.012);
    if (isNormMatch) return true;
  }

  // 3. Pixel bounding box match within 6px tolerance
  const xyxyA = geomA["source_bbox_xyxy"] as [number, number, number, number] | undefined;
  const xyxyB = geomB["source_bbox_xyxy"] as [number, number, number, number] | undefined;
  if (Array.isArray(xyxyA) && Array.isArray(xyxyB) && xyxyA.length === 4 && xyxyB.length === 4) {
    const isXyxyMatch = xyxyA.every((val, idx) => Math.abs(val - xyxyB[idx]!) <= 6);
    if (isXyxyMatch) return true;
  }

  return false;
}

/**
 * Checks an incoming detection against an array of existing rooms on the floor.
 * Returns match status and existing room ID / name if found.
 */
export function findMatchingExistingRoom(
  detectionNorm: [number, number, number, number],
  detectionXyxy: [number, number, number, number],
  existingRooms: ExistingRoomLike[]
): { isAlreadyImported: boolean; existingRoom?: ExistingRoomLike } {
  const incomingGeom = {
    source: "yolo_detector",
    detection_id: generateDetectionFingerprint(detectionNorm),
    source_bbox_norm: detectionNorm,
    source_bbox_xyxy: detectionXyxy,
  };

  for (const room of existingRooms) {
    if (isSameDetection(incomingGeom, room.geometry)) {
      return { isAlreadyImported: true, existingRoom: room };
    }
  }

  return { isAlreadyImported: false };
}

// ── Scale Calibration & Real-World Measurement Utilities ────────────────────

// Minimum canvas units between reference points A and B for a reliable calibration line
export const MIN_CALIBRATION_LINE_UNITS = 2.0;

// Plausible real-world scale boundaries for architectural drawings:
// 0.02 m/unit = 20 mm/unit (total 76-unit envelope = 1.52m x 1.08m, e.g. kiosk / tiny structure)
// 2.00 m/unit = 2000 mm/unit (total 76-unit envelope = 152m x 108m, e.g. large institutional floor plate)
export const CALIBRATION_BOUNDS = {
  MIN_METERS_PER_UNIT: 0.02,
  MAX_METERS_PER_UNIT: 2.0,
  RECOMMENDED_MIN: 0.05,
  RECOMMENDED_MAX: 0.50,
  // Standard metric architectural drawing scales
  STANDARD_METRIC_SCALES: [10, 20, 25, 50, 100, 125, 200, 250, 500],
};

export interface ScaleCalibration {
  isCalibrated: boolean;
  metersPerUnit: number;
  unitsPerMeter: number;
  realDistanceM: number;
  canvasUnitsDist: number;
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  calibratedAt: string;
  ratioString: string;
  envelopeWidthM?: number | undefined;
  envelopeHeightM?: number | undefined;
  isPlausible?: boolean | undefined;
}

/**
 * Checks if a scale calibration factor is architecturally plausible (not zero, negative, or absurdly oversized).
 */
export function isScaleCalibrationPlausible(metersPerUnit?: number | null): boolean {
  if (metersPerUnit == null || !Number.isFinite(metersPerUnit)) return false;
  return metersPerUnit >= CALIBRATION_BOUNDS.MIN_METERS_PER_UNIT && metersPerUnit <= CALIBRATION_BOUNDS.MAX_METERS_PER_UNIT;
}

export interface CalibrationValidationResult {
  isValid: boolean;
  isPlausible: boolean;
  error?: string | undefined;
  warning?: string | undefined;
  canvasUnitsDist: number;
  realDistanceM: number;
  metersPerUnit: number;
  unitsPerMeter: number;
  ratioString: string;
  envelopeWidthM: number;
  envelopeHeightM: number;
  envelopeAreaSqm: number;
}

/**
 * Converts a metersPerUnit factor into a standard architectural ratio string (e.g. "1:20", "1:50", "1:100").
 * Maps drawing sheet coordinates (where 1 canvas grid unit corresponds to nominal 10mm grid)
 * to real-world metric dimensions: 10mm : (metersPerUnit * 1000mm) = 1 : round(metersPerUnit * 100).
 */
export function getStandardScaleRatioString(metersPerUnit: number): string {
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) return "1:100 (uncalibrated)";
  const rawRatio = Math.round(metersPerUnit * 100);
  if (rawRatio <= 0) return "1:1";

  // Find nearest standard architectural scale if within 15% tolerance
  const standard = CALIBRATION_BOUNDS.STANDARD_METRIC_SCALES.find(
    (s) => Math.abs(s - rawRatio) / rawRatio <= 0.15
  );
  if (standard) {
    return `1:${standard}`;
  }
  return `1:${rawRatio}`;
}

/**
 * Validates a potential scale calibration for numerical validity, non-zero distance,
 * minimum reference line length, and architectural plausibility.
 */
export function validateCalibrationScale(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  realDistanceM: number
): CalibrationValidationResult {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const canvasUnitsDist = Math.hypot(dx, dy);

  if (!Number.isFinite(canvasUnitsDist) || canvasUnitsDist <= 0) {
    return {
      isValid: false,
      isPlausible: false,
      error: "Reference points A and B cannot be identical.",
      canvasUnitsDist: 0,
      realDistanceM,
      metersPerUnit: 0,
      unitsPerMeter: 0,
      ratioString: "invalid",
      envelopeWidthM: 0,
      envelopeHeightM: 0,
      envelopeAreaSqm: 0,
    };
  }

  if (canvasUnitsDist < MIN_CALIBRATION_LINE_UNITS) {
    return {
      isValid: false,
      isPlausible: false,
      error: `Reference line is too short (${canvasUnitsDist.toFixed(1)} units < ${MIN_CALIBRATION_LINE_UNITS} min). Select two points further apart across a wall, room, or outer dimension.`,
      canvasUnitsDist: Math.round(canvasUnitsDist * 100) / 100,
      realDistanceM,
      metersPerUnit: 0,
      unitsPerMeter: 0,
      ratioString: "invalid",
      envelopeWidthM: 0,
      envelopeHeightM: 0,
      envelopeAreaSqm: 0,
    };
  }

  if (!Number.isFinite(realDistanceM) || realDistanceM <= 0) {
    return {
      isValid: false,
      isPlausible: false,
      error: "Real-world distance must be a positive number greater than zero.",
      canvasUnitsDist: Math.round(canvasUnitsDist * 100) / 100,
      realDistanceM,
      metersPerUnit: 0,
      unitsPerMeter: 0,
      ratioString: "invalid",
      envelopeWidthM: 0,
      envelopeHeightM: 0,
      envelopeAreaSqm: 0,
    };
  }

  const metersPerUnit = realDistanceM / canvasUnitsDist;
  const unitsPerMeter = canvasUnitsDist / realDistanceM;
  const envelopeWidthM = Math.round(CANVAS_GRID.OUTER_WIDTH * metersPerUnit * 10) / 10;
  const envelopeHeightM = Math.round(CANVAS_GRID.OUTER_HEIGHT * metersPerUnit * 10) / 10;
  const envelopeAreaSqm = Math.round(envelopeWidthM * envelopeHeightM);
  const ratioString = getStandardScaleRatioString(metersPerUnit);

  // Check architectural plausibility
  if (metersPerUnit > CALIBRATION_BOUNDS.MAX_METERS_PER_UNIT) {
    return {
      isValid: false,
      isPlausible: false,
      error: `Implausible scale: 1 unit = ${metersPerUnit.toFixed(2)}m (${ratioString}) would produce an envelope of ${envelopeWidthM}m × ${envelopeHeightM}m (${envelopeAreaSqm.toLocaleString()} m²). Please verify that your entered distance (${realDistanceM}m) matches the measured reference line (${canvasUnitsDist.toFixed(1)} units), not the entire building.`,
      canvasUnitsDist: Math.round(canvasUnitsDist * 100) / 100,
      realDistanceM,
      metersPerUnit,
      unitsPerMeter,
      ratioString,
      envelopeWidthM,
      envelopeHeightM,
      envelopeAreaSqm,
    };
  }

  if (metersPerUnit < CALIBRATION_BOUNDS.MIN_METERS_PER_UNIT) {
    return {
      isValid: false,
      isPlausible: false,
      error: `Implausible scale: 1 unit = ${(metersPerUnit * 1000).toFixed(0)}mm would produce an undersized envelope (${envelopeWidthM}m × ${envelopeHeightM}m). Check that the real distance is entered in the correct unit (meters, millimeters, or feet).`,
      canvasUnitsDist: Math.round(canvasUnitsDist * 100) / 100,
      realDistanceM,
      metersPerUnit,
      unitsPerMeter,
      ratioString,
      envelopeWidthM,
      envelopeHeightM,
      envelopeAreaSqm,
    };
  }

  let warning: string | undefined;
  if (
    metersPerUnit < CALIBRATION_BOUNDS.RECOMMENDED_MIN ||
    metersPerUnit > CALIBRATION_BOUNDS.RECOMMENDED_MAX
  ) {
    warning = `Scale (1 unit = ${metersPerUnit.toFixed(2)}m, ${ratioString}) produces a building envelope of ${envelopeWidthM}m × ${envelopeHeightM}m (${envelopeAreaSqm.toLocaleString()} m²). Valid, but outside typical residential standards (4m - 40m).`;
  }

  return {
    isValid: true,
    isPlausible: true,
    warning,
    canvasUnitsDist: Math.round(canvasUnitsDist * 100) / 100,
    realDistanceM,
    metersPerUnit,
    unitsPerMeter,
    ratioString,
    envelopeWidthM,
    envelopeHeightM,
    envelopeAreaSqm,
  };
}

/**
 * Computes verified scale calibration from two user-selected canvas reference points
 * and a known real-world distance in metres.
 */
export function computeScaleFromReference(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  realDistanceM: number
): ScaleCalibration {
  const validation = validateCalibrationScale(pointA, pointB, realDistanceM);
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid calibration parameters.");
  }

  return {
    isCalibrated: true,
    metersPerUnit: validation.metersPerUnit,
    unitsPerMeter: validation.unitsPerMeter,
    realDistanceM: validation.realDistanceM,
    canvasUnitsDist: validation.canvasUnitsDist,
    pointA: { x: Math.round(pointA.x * 10) / 10, y: Math.round(pointA.y * 10) / 10 },
    pointB: { x: Math.round(pointB.x * 10) / 10, y: Math.round(pointB.y * 10) / 10 },
    calibratedAt: new Date().toISOString(),
    ratioString: validation.ratioString,
    envelopeWidthM: validation.envelopeWidthM,
    envelopeHeightM: validation.envelopeHeightM,
    isPlausible: validation.isPlausible,
  };
}

/**
 * Calculates verified room dimensions and area in m² and sq ft using calibrated scale.
 */
export function calculateCalibratedRoomDimensions(
  wUnits: number,
  hUnits: number,
  metersPerUnit: number
): {
  widthM: number;
  heightM: number;
  widthFt: number;
  heightFt: number;
  areaSqm: number;
  areaSqft: number;
  isPlausible: boolean;
} {
  const widthM = Math.round(wUnits * metersPerUnit * 100) / 100;
  const heightM = Math.round(hUnits * metersPerUnit * 100) / 100;
  const widthFt = Math.round(widthM * 3.28084 * 10) / 10;
  const heightFt = Math.round(heightM * 3.28084 * 10) / 10;
  const areaSqm = Math.round(widthM * heightM * 10) / 10;
  const areaSqft = sqmToSqft(areaSqm);

  // Plausibility check: typical individual rooms are between 1 m² and 300 m²
  const isPlausible = areaSqm >= 0.5 && areaSqm <= 350;

  return { widthM, heightM, widthFt, heightFt, areaSqm, areaSqft, isPlausible };
}

/**
 * Formats a canvas coordinate length into real-world units (mm, m, ft).
 * If isCalibrated is false or scale is implausible, clearly marks it as an estimate.
 */
export function formatRealWorldDistance(
  units: number,
  metersPerUnit: number | null | undefined,
  preferredUnit: "mm" | "m" | "ft" = "mm",
  options?: { isCalibrated?: boolean; isEstimate?: boolean }
): string {
  const isPlausible = isScaleCalibrationPlausible(metersPerUnit);
  const effectiveMetersPerUnit = isPlausible && metersPerUnit ? metersPerUnit : 12.8 / 68;
  const isEstimate = !options?.isCalibrated || !isPlausible || Boolean(options?.isEstimate);

  const meters = units * effectiveMetersPerUnit;
  if (preferredUnit === "mm") {
    const val = Math.round(meters * 1000).toLocaleString();
    return isEstimate ? `${val} mm (est)` : `${val} mm`;
  }
  if (preferredUnit === "ft") {
    const val = (meters * 3.28084).toFixed(1);
    return isEstimate ? `${val} ft (est)` : `${val} ft`;
  }
  const val = meters.toFixed(2);
  return isEstimate ? `${val} m (est)` : `${val} m`;
}

// ── Multi-Unit Scale Calibration Helpers ─────────────────────────────────────

export type CalibrationUnit = "mm" | "cm" | "m" | "ft";

/**
 * Converts user-entered distance in any supported architectural unit to canonical metres.
 */
export function convertDistanceToMeters(value: number, unit: CalibrationUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  switch (unit) {
    case "mm":
      return value / 1000;
    case "cm":
      return value / 100;
    case "ft":
      return value / 3.28084;
    case "m":
    default:
      return value;
  }
}

/**
 * Converts canonical metres into the requested display unit.
 */
export function convertMetersToUnit(meters: number, unit: CalibrationUnit): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  switch (unit) {
    case "mm":
      return Math.round(meters * 1000);
    case "cm":
      return Math.round(meters * 100 * 10) / 10;
    case "ft":
      return Math.round(meters * 3.28084 * 100) / 100;
    case "m":
    default:
      return Math.round(meters * 1000) / 1000;
  }
}

// ── Floor Area & Unallocated Circulation/Walls Breakdown ─────────────────────

export interface FloorAreaBreakdown {
  floorAreaSqm: number;
  roomsTotalAreaSqm: number;
  roomsTotalAreaSqft: number;
  unallocatedAreaSqm: number;
  unallocatedAreaSqft: number;
  unallocatedPct: number;
  allocatedPct: number;
  aiEstimateCount: number;
  aiEstimateAreaSqm: number;
  userCorrectedCount: number;
  userCorrectedAreaSqm: number;
  calibratedCount: number;
  calibratedAreaSqm: number;
  totalRoomsCount: number;
}

/**
 * Computes independent floor area breakdown:
 * separates original floor area, sum of rooms, circulation/wall unallocated space,
 * and room areas grouped by authoritative measurement provenance.
 */
export function calculateFloorAreaBreakdown(
  floorAreaSqm: number | null | undefined,
  rooms: Array<{
    area_sqm?: number | null;
    area?: number;
    measurementStatus?: MeasurementStatus;
    isEstimate?: boolean;
    isCalibratedCalc?: boolean;
  }>
): FloorAreaBreakdown {
  const floorArea = Math.max(0, floorAreaSqm || 0);

  let roomsTotal = 0;
  let aiEstCount = 0;
  let aiEstArea = 0;
  let userCorrCount = 0;
  let userCorrArea = 0;
  let calibCount = 0;
  let calibArea = 0;

  for (const r of rooms) {
    const roomArea = r.area_sqm != null ? r.area_sqm : sqftToSqm(r.area || 0);
    roomsTotal += roomArea;

    const status: MeasurementStatus =
      r.measurementStatus ||
      (r.isCalibratedCalc ? "calibrated" : r.isEstimate ? "ai_estimate" : "user_corrected");

    if (status === "calibrated") {
      calibCount++;
      calibArea += roomArea;
    } else if (status === "user_corrected") {
      userCorrCount++;
      userCorrArea += roomArea;
    } else {
      aiEstCount++;
      aiEstArea += roomArea;
    }
  }

  const roundedRoomsTotal = Math.round(roomsTotal * 10) / 10;
  const unallocated = Math.max(0, Math.round((floorArea - roundedRoomsTotal) * 10) / 10);
  const allocatedPct = floorArea > 0 ? Math.min(100, Math.round((roundedRoomsTotal / floorArea) * 100)) : 100;
  const unallocatedPct = floorArea > 0 ? Math.max(0, 100 - allocatedPct) : 0;

  return {
    floorAreaSqm: floorArea,
    roomsTotalAreaSqm: roundedRoomsTotal,
    roomsTotalAreaSqft: sqmToSqft(roundedRoomsTotal),
    unallocatedAreaSqm: unallocated,
    unallocatedAreaSqft: sqmToSqft(unallocated),
    unallocatedPct,
    allocatedPct,
    aiEstimateCount: aiEstCount,
    aiEstimateAreaSqm: Math.round(aiEstArea * 10) / 10,
    userCorrectedCount: userCorrCount,
    userCorrectedAreaSqm: Math.round(userCorrArea * 10) / 10,
    calibratedCount: calibCount,
    calibratedAreaSqm: Math.round(calibArea * 10) / 10,
    totalRoomsCount: rooms.length,
  };
}

// ── Architectural Boundary & Envelope Validation ─────────────────────────────

export interface BoundaryValidationResult {
  isOutOfBounds: boolean;
  violations: string[];
}

/**
 * Validates whether a room is within the usable building boundary envelope.
 */
export function validateRoomBoundaries(
  room: { x: number; y: number; w: number; h: number; name?: string }
): BoundaryValidationResult {
  const violations: string[] = [];
  if (room.x < CANVAS_GRID.INNER_X_MIN) {
    violations.push(`Crosses west envelope by ${(CANVAS_GRID.INNER_X_MIN - room.x).toFixed(1)}u`);
  }
  if (room.y < CANVAS_GRID.INNER_Y_MIN) {
    violations.push(`Crosses north envelope by ${(CANVAS_GRID.INNER_Y_MIN - room.y).toFixed(1)}u`);
  }
  if (room.x + room.w > CANVAS_GRID.INNER_X_MAX) {
    violations.push(`Crosses east envelope by ${(room.x + room.w - CANVAS_GRID.INNER_X_MAX).toFixed(1)}u`);
  }
  if (room.y + room.h > CANVAS_GRID.INNER_Y_MAX) {
    violations.push(`Crosses south envelope by ${(room.y + room.h - CANVAS_GRID.INNER_Y_MAX).toFixed(1)}u`);
  }

  return {
    isOutOfBounds: violations.length > 0,
    violations,
  };
}

