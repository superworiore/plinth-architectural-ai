import { useState, useMemo, useRef, useCallback } from "react";
import { rooms } from "@/lib/plinth-data";
import {
  detectAllOverlaps,
  formatRealWorldDistance,
  type ScaleCalibration,
  type MeasurementStatus,
} from "@/lib/geometry-utils";

export interface RoomData {
  id: string;
  name: string;
  type?: string;
  area: number;        // Display unit (sq ft)
  area_sqm?: number;   // Canonical unit (m²)
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: string;
  measurementStatus?: MeasurementStatus;
  isEstimate?: boolean;
  isCalibratedCalc?: boolean;
  isManual?: boolean;
  hasOverlap?: boolean;
  overlappingRoomNames?: string[];
}

export interface FloorPlanProps {
  selected?: string | null;
  onSelect?: (id: string) => void;
  showDims?: boolean;
  zoom?: number;
  roomList?: RoomData[];
  onRoomChange?: (id: string, coords: { x: number; y: number; w: number; h: number }) => void;
  onRoomChangeEnd?: (id: string, coords: { x: number; y: number; w: number; h: number }) => void;
  isCalibrating?: boolean;
  calibrationPoints?: {
    a: { x: number; y: number } | null;
    b: { x: number; y: number } | null;
  };
  onCalibrationClick?: (pt: { x: number; y: number }) => void;
  calibrationScale?: ScaleCalibration | null;
}

type DragHandle = "none" | "body" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

interface DragState {
  handle: DragHandle;
  roomId: string;
  startGridX: number;
  startGridY: number;
  initX: number;
  initY: number;
  initW: number;
  initH: number;
  currentCoords: { x: number; y: number; w: number; h: number };
}

/**
 * Architectural 2D Floor Plan SVG Canvas.
 * Supports:
 * - Interactive room selection, real-time dragging & corner resizing
 * - Two-point scale calibration visualization and measurement references
 * - Collision and shared partition wall detection
 * - Aspect-ratio preserving SVG coordinate mapping
 */
export function FloorPlan({
  selected,
  onSelect,
  showDims = true,
  zoom = 1,
  roomList,
  onRoomChange,
  onRoomChangeEnd,
  isCalibrating = false,
  calibrationPoints,
  onCalibrationClick,
  calibrationScale,
}: FloorPlanProps) {
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activeRooms: RoomData[] = (roomList !== undefined ? roomList : rooms) as RoomData[];
  const S = 12; // Base scale: 1 grid unit = 12/1.05 px ≈ 11.4285 px in SVG space
  const unitPx = S / 1.05;

  // Active Drag State for moving / resizing
  const [dragState, setDragState] = useState<DragState>({
    handle: "none",
    roomId: "",
    startGridX: 0,
    startGridY: 0,
    initX: 0,
    initY: 0,
    initW: 0,
    initH: 0,
    currentCoords: { x: 0, y: 0, w: 0, h: 0 },
  });

  // Track cursor position when actively drawing calibration reference line
  const [calibHoverPt, setCalibHoverPt] = useState<{ x: number; y: number } | null>(null);

  // Convert browser mouse event to SVG grid coordinates
  const getGridCoords = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgP = pt.matrixTransform(ctm.inverse());
    // Translate origin offset is (100, 75)
    const gridX = (svgP.x - 100) / unitPx;
    const gridY = (svgP.y - 75) / unitPx;
    return { x: gridX, y: gridY };
  }, [unitPx]);

  // Pointer Down on a Handle or Room Body
  function handleStartDrag(
    e: React.PointerEvent,
    room: RoomData,
    handle: DragHandle
  ) {
    if (isCalibrating) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const gridPt = getGridCoords(e);
    setDragState({
      handle,
      roomId: room.id,
      startGridX: gridPt.x,
      startGridY: gridPt.y,
      initX: room.x,
      initY: room.y,
      initW: room.w,
      initH: room.h,
      currentCoords: { x: room.x, y: room.y, w: room.w, h: room.h },
    });
    onSelect?.(room.id);
  }

  // Pointer Move on the whole SVG
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (isCalibrating && ptA && !ptB) {
      const gridPt = getGridCoords(e);
      setCalibHoverPt({
        x: Math.max(0, Math.min(76, Math.round(gridPt.x * 2) / 2)),
        y: Math.max(0, Math.min(54, Math.round(gridPt.y * 2) / 2)),
      });
      return;
    }

    if (dragState.handle === "none" || !dragState.roomId) return;
    const gridPt = getGridCoords(e);
    const dx = Math.round(gridPt.x - dragState.startGridX);
    const dy = Math.round(gridPt.y - dragState.startGridY);

    let newX = dragState.initX;
    let newY = dragState.initY;
    let newW = dragState.initW;
    let newH = dragState.initH;

    const MAX_X = 76;
    const MAX_Y = 54;
    const MIN_DIM = 4;

    switch (dragState.handle) {
      case "body":
        newX = Math.max(0, Math.min(MAX_X - dragState.initW, dragState.initX + dx));
        newY = Math.max(0, Math.min(MAX_Y - dragState.initH, dragState.initY + dy));
        break;

      case "se": // South-East handle: expands width and height
        newW = Math.max(MIN_DIM, Math.min(MAX_X - dragState.initX, dragState.initW + dx));
        newH = Math.max(MIN_DIM, Math.min(MAX_Y - dragState.initY, dragState.initH + dy));
        break;

      case "nw": // North-West handle: modifies x, y, w, h
        newX = Math.max(0, Math.min(dragState.initX + dragState.initW - MIN_DIM, dragState.initX + dx));
        newY = Math.max(0, Math.min(dragState.initY + dragState.initH - MIN_DIM, dragState.initY + dy));
        newW = dragState.initW - (newX - dragState.initX);
        newH = dragState.initH - (newY - dragState.initY);
        break;

      case "ne": // North-East handle: modifies y, w, h
        newY = Math.max(0, Math.min(dragState.initY + dragState.initH - MIN_DIM, dragState.initY + dy));
        newW = Math.max(MIN_DIM, Math.min(MAX_X - dragState.initX, dragState.initW + dx));
        newH = dragState.initH - (newY - dragState.initY);
        break;

      case "sw": // South-West handle: modifies x, w, h
        newX = Math.max(0, Math.min(dragState.initX + dragState.initW - MIN_DIM, dragState.initX + dx));
        newW = dragState.initW - (newX - dragState.initX);
        newH = Math.max(MIN_DIM, Math.min(MAX_Y - dragState.initY, dragState.initH + dy));
        break;

      case "n": // North edge handle: modifies y, h
        newY = Math.max(0, Math.min(dragState.initY + dragState.initH - MIN_DIM, dragState.initY + dy));
        newH = dragState.initH - (newY - dragState.initY);
        break;

      case "s": // South edge handle: modifies h
        newH = Math.max(MIN_DIM, Math.min(MAX_Y - dragState.initY, dragState.initH + dy));
        break;

      case "w": // West edge handle: modifies x, w
        newX = Math.max(0, Math.min(dragState.initX + dragState.initW - MIN_DIM, dragState.initX + dx));
        newW = dragState.initW - (newX - dragState.initX);
        break;

      case "e": // East edge handle: modifies w
        newW = Math.max(MIN_DIM, Math.min(MAX_X - dragState.initX, dragState.initW + dx));
        break;
    }

    const updatedCoords = { x: newX, y: newY, w: newW, h: newH };
    setDragState((prev) => ({ ...prev, currentCoords: updatedCoords }));
    onRoomChange?.(dragState.roomId, updatedCoords);
  }

  // Pointer Up: Commit Changes
  function handlePointerUp() {
    if (dragState.handle !== "none" && dragState.roomId) {
      onRoomChangeEnd?.(dragState.roomId, dragState.currentCoords);
    }
    setDragState({
      handle: "none",
      roomId: "",
      startGridX: 0,
      startGridY: 0,
      initX: 0,
      initY: 0,
      initW: 0,
      initH: 0,
      currentCoords: { x: 0, y: 0, w: 0, h: 0 },
    });
  }

  // Handle canvas click for calibration
  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!isCalibrating) return;
    const gridPt = getGridCoords(e);
    // Clamp to reasonable plan boundary
    const x = Math.max(0, Math.min(76, Math.round(gridPt.x * 2) / 2));
    const y = Math.max(0, Math.min(54, Math.round(gridPt.y * 2) / 2));
    onCalibrationClick?.({ x, y });
  }

  // Detect pairwise collisions dynamically
  const overlapMap = useMemo(() => {
    return detectAllOverlaps(
      activeRooms.map((r) => ({
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
      }))
    );
  }, [activeRooms]);

  const ptA = calibrationPoints?.a;
  const ptB = calibrationPoints?.b;
  const calibDistUnits = ptA && ptB ? Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y) : null;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1080 760"
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full max-h-full max-w-full select-none ${
        isCalibrating ? "cursor-crosshair" : dragState.handle !== "none" ? "cursor-grabbing" : ""
      }`}
      style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.15s ease-out" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleSvgClick}
    >
      <defs>
        <pattern id="fine" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-foreground/10" />
        </pattern>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="3" className="text-foreground/70" />
        </pattern>
        <pattern id="overlap-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(234, 88, 12)" strokeWidth="1.5" strokeOpacity="0.4" />
        </pattern>
      </defs>
      <rect width="1080" height="760" fill="url(#fine)" />

      <g transform="translate(100, 75)">
        {/* outer perimeter wall: 76 units x 54 units */}
        <rect
          x={0}
          y={0}
          width={76 * unitPx}
          height={54 * unitPx}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-foreground"
        />

        {/* Room Rectangles */}
        <g className={isCalibrating ? "pointer-events-none" : ""}>
          {activeRooms.map((r, idx) => {
          const isSel = selected === r.id;
          const isHov = hover === r.id;
          const overlaps = overlapMap.get(idx) || [];
          const hasSevereCollision = overlaps.some((o) => !o.isSharedBoundary);

          // Visual styles
          let strokeColor = "text-foreground/80";
          let strokeDash = undefined;
          let strokeWidth = isSel ? 3 : 2;

          if (isSel) {
            strokeColor = hasSevereCollision ? "text-amber-500" : "text-accent";
          } else if (hasSevereCollision) {
            strokeColor = "text-amber-500/80";
            strokeDash = "4 3";
          } else if (r.isEstimate) {
            strokeColor = "text-foreground/75";
          }

          const fillColor = isSel
            ? hasSevereCollision
              ? "color-mix(in oklab, rgb(234, 88, 12) 15%, transparent)"
              : "color-mix(in oklab, var(--oxide) 14%, transparent)"
            : isHov
            ? "color-mix(in oklab, var(--foreground) 5%, transparent)"
            : hasSevereCollision
            ? "color-mix(in oklab, rgb(234, 88, 12) 8%, transparent)"
            : "transparent";

          const centerX = (r.x + r.w / 2) * unitPx;
          const centerY = (r.y + r.h / 2) * unitPx;

          const duplicateOfEarlier = activeRooms.findIndex(
            (other, oIdx) =>
              oIdx < idx &&
              Math.abs(other.x - r.x) <= 3 &&
              Math.abs(other.y - r.y) <= 3
          );
          const isDuplicateOffset = duplicateOfEarlier !== -1;
          const labelYOffset = isDuplicateOffset ? 12 : 0;

          return (
            <g
              key={r.id}
              onMouseEnter={() => setHover(r.id)}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                if (isCalibrating) return;
                e.stopPropagation();
                onSelect?.(r.id);
              }}
              style={{ cursor: isCalibrating ? "crosshair" : isSel ? "move" : onSelect ? "pointer" : "default" }}
            >
              {/* Main Room Rectangle */}
              <rect
                x={r.x * unitPx}
                y={r.y * unitPx}
                width={r.w * unitPx}
                height={r.h * unitPx}
                fill={fillColor}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDash}
                className={strokeColor}
                onPointerDown={(e) => {
                  if (isSel) {
                    handleStartDrag(e, r, "body");
                  }
                }}
              />

              {/* Room Name */}
              <text
                x={centerX}
                y={centerY - 2 + labelYOffset}
                textAnchor="middle"
                className="fill-foreground font-mono pointer-events-none select-none"
                fontSize="11"
                letterSpacing="1.2"
                fontWeight="500"
              >
                {r.name.toUpperCase()}{isDuplicateOffset ? " (DUP)" : ""}
              </text>

              {/* Area & Provenance Tag */}
              <text
                x={centerX}
                y={centerY + 14 + labelYOffset}
                textAnchor="middle"
                className="fill-muted-foreground font-mono pointer-events-none select-none"
                fontSize="9"
              >
                {r.measurementStatus === "calibrated" || r.isCalibratedCalc
                  ? `CALIB. ${r.area} SQ FT`
                  : r.measurementStatus === "ai_estimate" || r.isEstimate
                  ? `EST. ${r.area} SQ FT`
                  : `${r.area} SQ FT`}
              </text>

              {hasSevereCollision && (
                <text
                  x={centerX}
                  y={centerY + 26 + labelYOffset}
                  textAnchor="middle"
                  className="fill-amber-600 font-mono text-[8px] font-semibold pointer-events-none select-none"
                  fontSize="8"
                >
                  ⚠️ OVERLAP
                </text>
              )}

              {/* Door swing indicator */}
              <path
                d={`M ${(r.x + 2) * unitPx} ${(r.y + r.h) * unitPx} a 28 28 0 0 0 28 -28`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-foreground/35 pointer-events-none"
              />

              {/* Interactive Resize Handles when Selected */}
              {isSel && !isCalibrating && (
                <g className="resize-handles">
                  {/* Top-Left (NW) */}
                  <rect
                    x={r.x * unitPx - 5}
                    y={r.y * unitPx - 5}
                    width={10}
                    height={10}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth={2}
                    style={{ cursor: "nwse-resize" }}
                    onPointerDown={(e) => handleStartDrag(e, r, "nw")}
                  />
                  {/* Top-Right (NE) */}
                  <rect
                    x={(r.x + r.w) * unitPx - 5}
                    y={r.y * unitPx - 5}
                    width={10}
                    height={10}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth={2}
                    style={{ cursor: "nesw-resize" }}
                    onPointerDown={(e) => handleStartDrag(e, r, "ne")}
                  />
                  {/* Bottom-Left (SW) */}
                  <rect
                    x={r.x * unitPx - 5}
                    y={(r.y + r.h) * unitPx - 5}
                    width={10}
                    height={10}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth={2}
                    style={{ cursor: "nesw-resize" }}
                    onPointerDown={(e) => handleStartDrag(e, r, "sw")}
                  />
                  {/* Bottom-Right (SE) - Accent fill for primary resize */}
                  <rect
                    x={(r.x + r.w) * unitPx - 5}
                    y={(r.y + r.h) * unitPx - 5}
                    width={10}
                    height={10}
                    fill="var(--foreground)"
                    stroke="var(--background)"
                    strokeWidth={2}
                    style={{ cursor: "nwse-resize" }}
                    onPointerDown={(e) => handleStartDrag(e, r, "se")}
                  />

                  {/* 4 Edge Handles (N, S, W, E) */}
                  {/* North (N) Edge */}
                  <rect
                    x={centerX - 4}
                    y={r.y * unitPx - 4}
                    width={8}
                    height={8}
                    rx={2}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    style={{ cursor: "ns-resize" }}
                    onPointerDown={(e) => handleStartDrag(e, r, "n")}
                  />
                  {/* South (S) Edge */}
                  <rect
                    x={centerX - 4}
                    y={(r.y + r.h) * unitPx - 4}
                    width={8}
                    height={8}
                    rx={2}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    style={{ cursor: "ns-resize" }}
                    onPointerDown={(e) => handleStartDrag(e, r, "s")}
                  />
                  {/* West (W) Edge */}
                  <rect
                    x={r.x * unitPx - 4}
                    y={centerY - 4}
                    width={8}
                    height={8}
                    rx={2}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    style={{ cursor: "ew-resize" }}
                    onPointerDown={(e) => handleStartDrag(e, r, "w")}
                  />
                  {/* East (E) Edge */}
                  <rect
                    x={(r.x + r.w) * unitPx - 4}
                    y={centerY - 4}
                    width={8}
                    height={8}
                    rx={2}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    style={{ cursor: "ew-resize" }}
                    onPointerDown={(e) => handleStartDrag(e, r, "e")}
                  />

                  {/* Dimension indicators while editing */}
                  <g className="pointer-events-none font-mono text-[9px]">
                    {/* Top Width */}
                    <rect
                      x={centerX - 46}
                      y={r.y * unitPx - 18}
                      width={92}
                      height={14}
                      fill="var(--background)"
                      stroke="var(--border)"
                      strokeWidth={1}
                      rx={2}
                    />
                    <text
                      x={centerX}
                      y={r.y * unitPx - 8}
                      textAnchor="middle"
                      className="fill-foreground font-mono text-[9px] font-semibold"
                    >
                      {r.w}u · {formatRealWorldDistance(r.w, calibrationScale?.metersPerUnit, "m", {
                        isCalibrated: r.measurementStatus === "calibrated",
                        isEstimate: r.measurementStatus === "ai_estimate" || !calibrationScale?.isCalibrated,
                      })}
                    </text>

                    {/* Right Height */}
                    <rect
                      x={(r.x + r.w) * unitPx + 4}
                      y={centerY - 7}
                      width={92}
                      height={14}
                      fill="var(--background)"
                      stroke="var(--border)"
                      strokeWidth={1}
                      rx={2}
                    />
                    <text
                      x={(r.x + r.w) * unitPx + 50}
                      y={centerY + 3}
                      textAnchor="middle"
                      className="fill-foreground font-mono text-[9px] font-semibold"
                    >
                      {r.h}u · {formatRealWorldDistance(r.h, calibrationScale?.metersPerUnit, "m", {
                        isCalibrated: r.measurementStatus === "calibrated",
                        isEstimate: r.measurementStatus === "ai_estimate" || !calibrationScale?.isCalibrated,
                      })}
                    </text>
                  </g>
                </g>
              )}
            </g>
          );
        })}
        </g>

        {/* Window marks on the north edge */}
        {[10, 30, 50].map((x) => (
          <rect key={x} x={x * unitPx} y={-3} width={54} height={6} fill="url(#hatch)" />
        ))}

        {/* Dimension Lines (Updated dynamically from scale calibration) */}
        {showDims && (
          <g className="text-muted-foreground" stroke="currentColor" strokeWidth="0.75">
            {/* North Dimension Line (Width: 76 units) */}
            <line x1={0} y1={-40} x2={76 * unitPx} y2={-40} />
            <line x1={0} y1={-46} x2={0} y2={-34} />
            <line x1={76 * unitPx} y1={-46} x2={76 * unitPx} y2={-34} />
            <text
              x={(76 * unitPx) / 2}
              y={-48}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              stroke="none"
              fontSize="10"
            >
              {formatRealWorldDistance(76, calibrationScale?.metersPerUnit, "mm", {
                isCalibrated: Boolean(calibrationScale?.isCalibrated),
              })}
            </text>

            {/* West Dimension Line (Height: 54 units) */}
            <line x1={-40} y1={0} x2={-40} y2={54 * unitPx} />
            <line x1={-46} y1={0} x2={-34} y2={0} />
            <line x1={-46} y1={54 * unitPx} x2={-34} y2={54 * unitPx} />
            <text
              x={-48}
              y={(54 * unitPx) / 2}
              textAnchor="middle"
              transform={`rotate(-90 -48 ${(54 * unitPx) / 2})`}
              className="fill-muted-foreground font-mono"
              stroke="none"
              fontSize="10"
            >
              {formatRealWorldDistance(54, calibrationScale?.metersPerUnit, "mm", {
                isCalibrated: Boolean(calibrationScale?.isCalibrated),
              })}
            </text>
          </g>
        )}

        {/* North Arrow */}
        <g transform="translate(840, 500)" className="text-foreground">
          <circle r="18" fill="none" stroke="currentColor" strokeWidth="1" className="text-foreground/40" />
          <path d="M0 -14 L5 6 L0 1 L-5 6 Z" fill="currentColor" />
          <text y="30" textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="9">
            N
          </text>
        </g>

        {/* Calibration Interactive Visuals */}
        {(isCalibrating || ptA || ptB) && (
          <g className="calibration-layer">
            {ptA && (
              <g>
                <circle
                  cx={ptA.x * unitPx}
                  cy={ptA.y * unitPx}
                  r={8}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={2}
                  className="animate-pulse"
                />
                <circle cx={ptA.x * unitPx} cy={ptA.y * unitPx} r={2} fill="#ffffff" />
                <text
                  x={ptA.x * unitPx}
                  y={ptA.y * unitPx - 12}
                  textAnchor="middle"
                  className="fill-blue-600 font-mono text-[10px] font-bold"
                >
                  POINT A ({ptA.x}, {ptA.y})
                </text>
              </g>
            )}

            {/* Live interactive guide line stretching to cursor */}
            {isCalibrating && ptA && !ptB && calibHoverPt && (
              <g className="pointer-events-none opacity-85">
                {(() => {
                  const dist = Math.hypot(calibHoverPt.x - ptA.x, calibHoverPt.y - ptA.y);
                  const isTooShort = dist < 2.0;
                  return (
                    <>
                      <line
                        x1={ptA.x * unitPx}
                        y1={ptA.y * unitPx}
                        x2={calibHoverPt.x * unitPx}
                        y2={calibHoverPt.y * unitPx}
                        stroke={isTooShort ? "#ef4444" : "#3b82f6"}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                      />
                      <circle
                        cx={calibHoverPt.x * unitPx}
                        cy={calibHoverPt.y * unitPx}
                        r={5}
                        fill={isTooShort ? "#ef4444" : "#2563eb"}
                        stroke="#ffffff"
                        strokeWidth={1}
                      />
                      <g
                        transform={`translate(${((ptA.x + calibHoverPt.x) / 2) * unitPx}, ${
                          ((ptA.y + calibHoverPt.y) / 2) * unitPx
                        })`}
                      >
                        <rect
                          x={-44}
                          y={-10}
                          width={88}
                          height={20}
                          fill={isTooShort ? "#7f1d1d" : "#1e3a8a"}
                          rx={3}
                          stroke="#ffffff"
                          strokeWidth={0.5}
                        />
                        <text
                          x={0}
                          y={4}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontFamily="monospace"
                          fontSize="9"
                          fontWeight="bold"
                        >
                          {dist.toFixed(1)}u {isTooShort ? "(min 2u)" : ""}
                        </text>
                      </g>
                    </>
                  );
                })()}
              </g>
            )}

            {ptB && (
              <g>
                <circle
                  cx={ptB.x * unitPx}
                  cy={ptB.y * unitPx}
                  r={8}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <circle cx={ptB.x * unitPx} cy={ptB.y * unitPx} r={2} fill="#ffffff" />
                <text
                  x={ptB.x * unitPx}
                  y={ptB.y * unitPx - 12}
                  textAnchor="middle"
                  className="fill-blue-600 font-mono text-[10px] font-bold"
                >
                  POINT B ({ptB.x}, {ptB.y})
                </text>
              </g>
            )}

            {ptA && ptB && calibDistUnits !== null && (
              <g>
                <line
                  x1={ptA.x * unitPx}
                  y1={ptA.y * unitPx}
                  x2={ptB.x * unitPx}
                  y2={ptB.y * unitPx}
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                />
                {/* Distance Badge at Midpoint */}
                <g transform={`translate(${((ptA.x + ptB.x) / 2) * unitPx}, ${((ptA.y + ptB.y) / 2) * unitPx})`}>
                  <rect
                    x={-45}
                    y={-11}
                    width={90}
                    height={22}
                    fill="#1e3a8a"
                    rx={3}
                    stroke="#93c5fd"
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontFamily="monospace"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {calibDistUnits.toFixed(1)} units
                  </text>
                </g>
              </g>
            )}
          </g>
        )}
      </g>
    </svg>
  );
}
