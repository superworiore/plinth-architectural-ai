import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  FloorplanDetectionResponse,
} from "@/lib/api";
import { useDetectFloorplan } from "@/hooks/use-api";
import {
  mapBboxToCanvas,
  detectAllOverlaps,
  separateOverlappingBoxes,
  estimateRoomAreaSqm,
  sqmToSqft,
  generateDetectionFingerprint,
  findMatchingExistingRoom,
  ExistingRoomLike,
  type MeasurementStatus,
  resolveMeasurementStatus,
  getMeasurementStatusInfo,
} from "@/lib/geometry-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface AIImportRoom {
  name: string;
  type: string;
  area_sqm: number;
  geometry: {
    x: number;
    y: number;
    w: number;
    h: number;
    orientation: string;
    source: string;
    confidence: number;
    source_bbox_xyxy: [number, number, number, number];
    source_bbox_norm: [number, number, number, number];
    is_ai_estimate: boolean;
    is_calibrated_calc?: boolean;
    measurement_status: MeasurementStatus;
    calibration_floor_area_sqm?: number | null;
    detection_id?: string;
  };
}

export interface ReviewableZone {
  id: string;
  detection_id: string;
  approved: boolean;
  name: string;
  type: string;
  confidence: number;
  bbox_xyxy: [number, number, number, number];
  bbox_norm: [number, number, number, number];
  w: number;
  h: number;
  x: number;
  y: number;
  estimatedAreaSqm: number;
  measurementStatus: MeasurementStatus;
  isCalibrated: boolean;
  isAlreadyImported?: boolean | undefined;
  existingRoomName?: string | undefined;
}

interface FloorPlanAIDetectionProps {
  activeFloorName?: string | undefined;
  activeFloorId?: string | undefined;
  projectId?: string | undefined;
  floorAreaSqm?: number | null | undefined;
  existingRooms?: ExistingRoomLike[] | undefined;
  onImportRooms?: ((rooms: AIImportRoom[]) => Promise<void>) | undefined;
  isImporting?: boolean | undefined;
}

const ROOM_TYPES = [
  "living",
  "bedroom",
  "kitchen",
  "bathroom",
  "dining",
  "office",
  "corridor",
  "balcony",
  "utility",
  "room",
];

export function FloorPlanAIDetection({
  activeFloorName = "Active Floor",
  activeFloorId,
  floorAreaSqm,
  existingRooms,
  onImportRooms,
  isImporting = false,
}: FloorPlanAIDetectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<FloorplanDetectionResponse | null>(null);
  const [reviewZones, setReviewZones] = useState<ReviewableZone[]>([]);
  const [hasImported, setHasImported] = useState(false);
  const [calibrationArea, setCalibrationArea] = useState<number>(() => floorAreaSqm || 118);
  const [isCalibrated, setIsCalibrated] = useState<boolean>(Boolean(floorAreaSqm && floorAreaSqm > 0));
  const [showSplitConfirmModal, setShowSplitConfirmModal] = useState(false);

  // Preview proposed proportional area split for confirmation modal (Phase 4)
  const proposedSplitPreview = useMemo(() => {
    if (!showSplitConfirmModal || reviewZones.length === 0) return [];
    const totalGridUnits = reviewZones.reduce((acc, z) => acc + z.w * z.h, 0);
    return reviewZones.map((z) => {
      const areaResult = estimateRoomAreaSqm(z.w, z.h, calibrationArea, totalGridUnits);
      const diff = Math.round((areaResult.areaSqm - z.estimatedAreaSqm) * 10) / 10;
      return {
        id: z.id,
        name: z.name,
        currentSqm: z.estimatedAreaSqm,
        proposedSqm: areaResult.areaSqm,
        diff,
      };
    });
  }, [showSplitConfirmModal, reviewZones, calibrationArea]);

  // Preview zoom & pan state
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({
    x: 0,
    y: 0,
    startPanX: 0,
    startPanY: 0,
  });

  const detectMutation = useDetectFloorplan();

  // Sync floor area from active floor data if loaded
  useEffect(() => {
    if (floorAreaSqm && floorAreaSqm > 0) {
      setCalibrationArea(floorAreaSqm);
      setIsCalibrated(true);
    }
  }, [floorAreaSqm]);

  // Re-synchronize already-imported detection status whenever floor rooms update
  useEffect(() => {
    if (reviewZones.length === 0 || !existingRooms) return;
    setReviewZones((prev) =>
      prev.map((z) => {
        const { isAlreadyImported, existingRoom } = findMatchingExistingRoom(
          z.bbox_norm,
          z.bbox_xyxy,
          existingRooms
        );
        const measurementStatus: MeasurementStatus =
          isAlreadyImported && existingRoom?.geometry
            ? resolveMeasurementStatus(existingRoom.geometry)
            : z.measurementStatus || "ai_estimate";

        return {
          ...z,
          isAlreadyImported,
          existingRoomName: existingRoom?.name,
          measurementStatus,
          isCalibrated: measurementStatus === "calibrated",
        };
      })
    );
  }, [existingRooms]);

  function handleWheelZoom(e: React.WheelEvent) {
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setPreviewZoom((z) => {
      const next = Math.min(3, Math.max(1, +(z + delta).toFixed(1)));
      if (next <= 1.05) {
        setPreviewPan({ x: 0, y: 0 });
      }
      return next;
    });
  }

  function handleStartPan(e: React.MouseEvent) {
    if (previewZoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: previewPan.x,
      startPanY: previewPan.y,
    };
  }

  function handlePanMove(e: React.MouseEvent) {
    if (!isPanning || previewZoom <= 1) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPreviewPan({
      x: panStartRef.current.startPanX + dx,
      y: panStartRef.current.startPanY + dy,
    });
  }

  function handleEndPan() {
    setIsPanning(false);
  }

  function handleResetPreview() {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  }

  // Dynamic overlap detection for current review zones
  const overlapMap = useMemo(() => {
    return detectAllOverlaps(
      reviewZones.map((z) => ({
        x: z.x,
        y: z.y,
        w: z.w,
        h: z.h,
      }))
    );
  }, [reviewZones]);

  const hasAnyOverlaps = overlapMap.size > 0;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setReviewZones([]);
    setHasImported(false);
  }

  async function handleAnalyze() {
    if (!file) {
      toast.error("Please select a floor-plan image first.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Select a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("The image must be 10 MB or smaller.");
      return;
    }

    setHasImported(false);

    try {
      const data = await detectMutation.mutateAsync(file);
      setResult(data);

      const imageW = data.image_width || 640;
      const imageH = data.image_height || 640;

      const rawZones = data.detections.filter((d) => d.class_name === "zone");

      // Calculate total grid unit area for proportional calibration
      let totalGridUnits = 0;
      const mappedBoxes = rawZones.map((d) => {
        const norm = (d.bbox_norm || [
          Math.max(0, d.bbox_xyxy[0] / imageW),
          Math.max(0, d.bbox_xyxy[1] / imageH),
          Math.min(1, d.bbox_xyxy[2] / imageW),
          Math.min(1, d.bbox_xyxy[3] / imageH),
        ]) as [number, number, number, number];
        const mapped = mapBboxToCanvas(norm, imageW, imageH);
        totalGridUnits += mapped.w * mapped.h;
        return { d, norm, mapped };
      });

      const zones: ReviewableZone[] = [];
      let zoneIndex = 1;

      for (const item of mappedBoxes) {
        const { d, norm, mapped } = item;
        const areaResult = estimateRoomAreaSqm(
          mapped.w,
          mapped.h,
          isCalibrated ? calibrationArea : null,
          totalGridUnits
        );

        const detection_id = generateDetectionFingerprint(norm);
        const { isAlreadyImported, existingRoom } = findMatchingExistingRoom(
          norm,
          d.bbox_xyxy as [number, number, number, number],
          existingRooms || []
        );

        const measurementStatus: MeasurementStatus =
          isAlreadyImported && existingRoom?.geometry
            ? resolveMeasurementStatus(existingRoom.geometry)
            : "ai_estimate";

        zones.push({
          id: `det-zone-${zoneIndex}`,
          detection_id,
          approved: isAlreadyImported ? false : d.confidence >= 0.25,
          isAlreadyImported,
          existingRoomName: existingRoom?.name,
          name: isAlreadyImported && existingRoom?.name
            ? existingRoom.name
            : `Zone ${zoneIndex < 10 ? "0" + zoneIndex : zoneIndex}`,
          type: isAlreadyImported && existingRoom && "type" in existingRoom && typeof existingRoom.type === "string"
            ? existingRoom.type
            : (zoneIndex === 1 ? "living" : zoneIndex === 2 ? "bedroom" : "room"),
          confidence: d.confidence,
          bbox_xyxy: d.bbox_xyxy,
          bbox_norm: norm,
          x: mapped.x,
          y: mapped.y,
          w: mapped.w,
          h: mapped.h,
          estimatedAreaSqm: areaResult.areaSqm,
          measurementStatus,
          isCalibrated: measurementStatus === "calibrated",
        });

        zoneIndex++;
      }

      setReviewZones(zones);

      if (zones.length === 0) {
        toast.info(
          "Analysis complete. No room zones detected in image (detected only doors/windows or none)."
        );
      } else {
        const importedCount = zones.filter((z) => z.isAlreadyImported).length;
        if (importedCount > 0) {
          toast.success(
            `Analysis complete: Found ${zones.length} room zones (${importedCount} already in ${activeFloorName}).`
          );
        } else {
          toast.success(
            `Analysis complete: Found ${zones.length} room zones mapped to architectural grid.`
          );
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to analyze floor plan.";
      toast.error(msg);
    }
  }

  function handleAutoSeparateOverlaps() {
    if (reviewZones.length <= 1) return;
    const separated = separateOverlappingBoxes(
      reviewZones.map((z) => ({ ...z }))
    );
    setReviewZones(separated);
    toast.success("Adjusted overlapping zones to non-intersecting positions.");
  }

  function handleRecalculateAreas(newCalibratedArea: number, enableCalibrated: boolean) {
    setCalibrationArea(newCalibratedArea);
    setIsCalibrated(enableCalibrated);

    const totalGridUnits = reviewZones.reduce((acc, z) => acc + z.w * z.h, 0);
    setReviewZones((prev) =>
      prev.map((z) => {
        const areaResult = estimateRoomAreaSqm(
          z.w,
          z.h,
          enableCalibrated ? newCalibratedArea : null,
          totalGridUnits
        );
        return {
          ...z,
          estimatedAreaSqm: areaResult.areaSqm,
          isCalibrated: areaResult.isCalibrated,
        };
      })
    );
  }

  function handleToggleApprove(id: string) {
    setReviewZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, approved: !z.approved } : z))
    );
  }

  function handleUpdateZoneField(
    id: string,
    field: keyof ReviewableZone,
    value: unknown
  ) {
    setReviewZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, [field]: value } : z))
    );
  }

  function handleToggleAll(approve: boolean) {
    setReviewZones((prev) => prev.map((z) => ({ ...z, approved: approve })));
  }

  async function handleImportApproved() {
    if (!activeFloorId) {
      toast.error("Please select a target floor first.");
      return;
    }

    const approved = reviewZones.filter((z) => z.approved);
    if (approved.length === 0) {
      toast.error("Please approve at least one room zone to import.");
      return;
    }

    // Check if any approved zones have unresolved overlaps
    const approvedOverlaps = detectAllOverlaps(
      approved.map((z) => ({ x: z.x, y: z.y, w: z.w, h: z.h }))
    );

    if (approvedOverlaps.size > 0) {
      const confirmImport = window.confirm(
        "Notice: Some approved room zones overlap on the canvas. We recommend clicking 'Auto-Separate' or adjusting boundaries before importing. Do you still want to import now?"
      );
      if (!confirmImport) return;
    }

    if (hasImported) {
      toast.info("These detections have already been imported to prevent duplicates.");
      return;
    }

    const importPayload: AIImportRoom[] = approved.map((z) => ({
      name: z.name.trim() || "Imported Room",
      type: z.type,
      area_sqm: z.estimatedAreaSqm,
      geometry: {
        x: z.x,
        y: z.y,
        w: z.w,
        h: z.h,
        orientation: "NE",
        source: "yolo_detector",
        confidence: z.confidence,
        source_bbox_xyxy: z.bbox_xyxy,
        source_bbox_norm: z.bbox_norm,
        is_ai_estimate: true,
        is_calibrated_calc: false,
        measurement_status: "ai_estimate",
        calibration_floor_area_sqm: calibrationArea,
        detection_id: z.detection_id,
      },
    }));

    try {
      if (onImportRooms) {
        await onImportRooms(importPayload);
        setHasImported(true);
        toast.success(
          `Successfully imported ${approved.length} approved room zones to ${activeFloorName}!`
        );
      }
    } catch {
      // Error handled by parent handler
    }
  }

  return (
    <section className="shrink-0 border-b border-border bg-sidebar/50 transition-all">
      {/* Compact Collapsed / Header Bar */}
      <div className="flex h-9 items-center justify-between px-3 text-[11px]">
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="font-mono font-semibold tracking-wide text-foreground">
            AI FLOOR PLAN VISION
          </span>
          <span className="hidden text-muted-foreground sm:inline">|</span>
          <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
            YOLO Detector (Door, Window, Zone)
          </span>
          {result && (
            <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent font-medium">
              {result.detection_count} detected ({reviewZones.length} zones)
            </span>
          )}
          {hasAnyOverlaps && (
            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[10px] text-amber-600 font-medium">
              ⚠️ Overlaps Detected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOpen && result && (
            <button
              onClick={handleImportApproved}
              disabled={isImporting || reviewZones.filter((z) => z.approved).length === 0}
              className="h-6 border border-accent bg-accent px-2 text-[10px] font-mono font-semibold text-accent-foreground transition-colors hover:bg-transparent hover:text-accent disabled:opacity-50"
            >
              {isImporting
                ? "Importing..."
                : reviewZones.length > 0 && reviewZones.every((z) => z.isAlreadyImported) && reviewZones.filter((z) => z.approved).length === 0
                ? "✓ All Zones in Floor Plan"
                : `Import Approved (${reviewZones.filter((z) => z.approved).length})`}
            </button>
          )}

          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex h-6 items-center border border-border bg-background px-2 font-mono text-[10px] hover:bg-accent/10 hover:border-foreground/30"
          >
            {isOpen ? "▲ Collapse Scanner" : "▼ Expand Scanner & Review"}
          </button>
        </div>
      </div>

      {/* Expanded Scanner & Review Body */}
      {isOpen && (
        <div className="border-t border-border bg-background/95 p-3">
          {/* Controls Bar: Upload & Calibration */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="max-w-[210px] font-mono text-[10px] file:mr-2 file:border-0 file:bg-foreground/10 file:px-2 file:py-1 file:font-mono file:text-[10px] file:text-foreground hover:file:bg-foreground/20"
              />
              <button
                onClick={handleAnalyze}
                disabled={!file || detectMutation.isPending}
                className="h-6 border border-foreground bg-foreground px-2.5 font-mono text-[10px] text-background transition-colors hover:bg-transparent hover:text-foreground disabled:opacity-50"
              >
                {detectMutation.isPending ? "Analyzing Plan..." : "Analyze Floor Plan"}
              </button>
            </div>

            {/* Target Floor Area Split Controls */}
            {reviewZones.length > 0 && (
              <div className="flex items-center gap-2 font-mono text-[10px] bg-sidebar/60 border border-border px-2 py-0.5">
                <span className="text-muted-foreground" title="Set estimated total floor area to distribute proportionally across detected zones">
                  Target Area (est):
                </span>
                <input
                  type="number"
                  min={10}
                  step={5}
                  value={calibrationArea}
                  onChange={(e) => setCalibrationArea(Number(e.target.value))}
                  className="h-5 w-14 border border-border bg-background px-1 text-right font-mono text-[10px]"
                />
                <span className="text-muted-foreground">m²</span>
                <button
                  type="button"
                  onClick={() => setShowSplitConfirmModal(true)}
                  className="h-5 px-1.5 text-[9px] border border-border bg-background hover:bg-muted text-foreground"
                  title="Distribute this target floor area proportionally among detected room zones"
                >
                  Apply Split
                </button>
                {hasAnyOverlaps && (
                  <button
                    type="button"
                    onClick={handleAutoSeparateOverlaps}
                    className="h-5 px-2 text-[9px] border border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 font-semibold"
                    title="Separate overlapping room bounding boxes so they don't intersect"
                  >
                    ✨ Auto-Separate
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Two-Column Responsive Workspace */}
          {result ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 h-[340px] md:h-[390px]">
              {/* Left Column: Annotated Visual Image with Aspect Ratio & Zoom/Pan */}
              <div className="flex flex-col min-h-0 border border-border/80 bg-sidebar/30 p-2">
                <div className="mb-1.5 flex items-center justify-between text-[10px]">
                  <span className="label-tech">YOLO Detections Visual Overlay</span>
                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    <span className="text-muted-foreground hidden sm:inline">
                      {result.image_width} × {result.image_height} px
                    </span>
                    <span className="text-muted-foreground/40 hidden sm:inline">|</span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.max(1, +(z - 0.2).toFixed(1)))}
                      className="h-4.5 px-1.5 border border-border bg-background hover:bg-muted font-bold"
                      title="Zoom Out"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-foreground font-semibold">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))}
                      className="h-4.5 px-1.5 border border-border bg-background hover:bg-muted font-bold"
                      title="Zoom In"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={handleResetPreview}
                      className="h-4.5 px-1.5 border border-border bg-background text-muted-foreground hover:text-foreground"
                      title="Reset Zoom to Fit"
                    >
                      Fit
                    </button>
                  </div>
                </div>
                <div
                  className={`flex-1 min-h-0 relative flex items-center justify-center overflow-hidden bg-black/10 rounded border border-border/40 select-none ${
                    previewZoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
                  }`}
                  onWheel={handleWheelZoom}
                  onMouseDown={handleStartPan}
                  onMouseMove={handlePanMove}
                  onMouseUp={handleEndPan}
                  onMouseLeave={handleEndPan}
                >
                  <img
                    src={result.annotated_image}
                    alt="AI Annotated Floor Plan"
                    className="max-h-full max-w-full object-contain pointer-events-none"
                    style={{
                      transform:
                        previewZoom > 1
                          ? `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`
                          : "none",
                      transformOrigin: "center center",
                      transition: isPanning ? "none" : "transform 0.12s ease-out",
                    }}
                  />
                  {previewZoom > 1 && (
                    <div className="absolute bottom-1 right-1 pointer-events-none bg-background/85 border border-border px-1.5 py-0.5 text-[8px] font-mono text-muted-foreground rounded shadow-sm">
                      Drag to Pan · Wheel to Zoom
                    </div>
                  )}
                </div>
                <p className="mt-1 font-mono text-[9px] text-muted-foreground truncate">
                  * Detections are AI estimates mapped to 12.8m × 9.2m canvas grid.
                </p>
              </div>

              {/* Right Column: Interactive Room Review Table */}
              <div className="flex flex-col min-h-0 border border-border/80 bg-sidebar/30 p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="label-tech">
                      Zone Review & Approval ({reviewZones.length})
                    </span>
                    {hasAnyOverlaps && (
                      <span className="font-mono text-[9px] text-amber-600 font-semibold bg-amber-500/10 px-1 py-0.2 border border-amber-500/30">
                        Overlap Warning
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleToggleAll(true)}
                      className="underline hover:opacity-75"
                    >
                      Approve All
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAll(false)}
                      className="underline hover:opacity-75"
                    >
                      Reject All
                    </button>
                  </div>
                </div>

                {hasAnyOverlaps && (
                  <div className="mb-1.5 border border-amber-500/30 bg-amber-500/10 p-1.5 font-mono text-[9px] text-amber-700 flex items-center justify-between">
                    <span>⚠️ Some detected zones overlap. Click &quot;Auto-Separate&quot; above or tweak boundaries.</span>
                  </div>
                )}

                {reviewZones.length === 0 ? (
                  <div className="flex-1 min-h-0 flex items-center justify-center border border-dashed border-border/60 p-4 text-center font-mono text-[11px] text-muted-foreground">
                    No room zones detected in this image. Try an image with clearer wall outlines.
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                    {reviewZones.map((z, idx) => {
                      const overlaps = overlapMap.get(idx);
                      const isOverlapping = Boolean(overlaps && overlaps.length > 0);

                      return (
                        <div
                          key={z.id}
                          className={`flex flex-col gap-1 p-2 border transition-colors ${
                            isOverlapping
                              ? "border-amber-500/60 bg-amber-500/5"
                              : z.approved
                              ? "border-foreground/30 bg-sidebar/80"
                              : "border-border/40 bg-sidebar/20 opacity-50"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={z.approved}
                                onChange={() => handleToggleApprove(z.id)}
                                className="accent-foreground h-3.5 w-3.5"
                              />
                              <span className="font-mono text-[10px] font-bold">#{idx + 1}</span>
                            </label>

                            <span className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[9px] text-muted-foreground shrink-0">
                              {(z.confidence * 100).toFixed(0)}% conf
                            </span>

                            {z.isAlreadyImported && (
                              <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.5 font-mono text-[8px] text-emerald-700 font-semibold shrink-0">
                                ✓ In Floor Plan ({z.existingRoomName || "Synced"})
                              </span>
                            )}

                            {isOverlapping && (
                              <span className="rounded bg-amber-500/20 px-1 py-0.5 font-mono text-[8px] text-amber-600 font-semibold shrink-0">
                                Overlaps #{overlaps!.map((o) => o.targetIndex + 1).join(", #")}
                              </span>
                            )}

                            {z.approved ? (
                              <>
                                <input
                                  type="text"
                                  value={z.name}
                                  onChange={(e) =>
                                    handleUpdateZoneField(z.id, "name", e.target.value)
                                  }
                                  placeholder="Room Name"
                                  className="h-6 w-24 sm:w-28 border border-border bg-background px-1.5 font-mono text-[10px] outline-none focus:border-foreground"
                                />

                                <select
                                  value={z.type}
                                  onChange={(e) =>
                                    handleUpdateZoneField(z.id, "type", e.target.value)
                                  }
                                  className="h-6 border border-border bg-background px-1 font-mono text-[10px] outline-none focus:border-foreground"
                                >
                                  {ROOM_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>

                                <div className="flex items-center gap-1 font-mono text-[10px] ml-auto">
                                  <input
                                    type="number"
                                    min={1}
                                    step={0.5}
                                    value={z.estimatedAreaSqm}
                                    onChange={(e) =>
                                      handleUpdateZoneField(
                                        z.id,
                                        "estimatedAreaSqm",
                                        Number(e.target.value)
                                      )
                                    }
                                    className="h-6 w-14 border border-border bg-background px-1 font-mono text-[10px] outline-none focus:border-foreground text-right"
                                  />
                                  <span className="text-[9px] text-muted-foreground">m²</span>
                                  <span className="text-[8px] text-muted-foreground">
                                    (~{sqmToSqft(z.estimatedAreaSqm)} sf)
                                  </span>
                                </div>
                              </>
                            ) : (
                              <span className="font-mono text-[10px] text-muted-foreground italic">
                                (Rejected — will not import)
                              </span>
                            )}
                          </div>

                          {/* Geometry Position Adjusters for manual refinement */}
                          {z.approved && (
                            <div className="flex items-center gap-3 font-mono text-[9px] text-muted-foreground pt-1 border-t border-border/40">
                              <span>Position: x={z.x}, y={z.y}</span>
                              <span>Size: {z.w} × {z.h} units</span>
                              <span className="ml-auto flex items-center gap-1">
                                {(() => {
                                  const statusInfo = getMeasurementStatusInfo(z.measurementStatus);
                                  return (
                                    <span
                                      className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold ${statusInfo.badgeClass}`}
                                      title={statusInfo.description}
                                    >
                                      {statusInfo.badgeText}
                                    </span>
                                  );
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-border/60 p-6 text-center font-mono text-[11px] text-muted-foreground">
              Select an architectural floor plan image (JPEG, PNG, WebP) and click &quot;Analyze Floor Plan&quot; to detect room zones, doors, and windows.
            </div>
          )}
        </div>
      )}

      {/* Target Area Split Confirmation Dialog (Phase 4: Explicit Confirmation Before Area Overwrite) */}
      <Dialog open={showSplitConfirmModal} onOpenChange={setShowSplitConfirmModal}>
        <DialogContent className="sm:max-w-md font-mono bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold tracking-wide">
              Confirm Target Area Proportional Split
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review proposed room area distribution before applying {calibrationArea} m² ({sqmToSqft(calibrationArea)} sq ft) across detected zones.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs space-y-2">
            <div className="max-h-56 overflow-y-auto border border-border">
              <table className="w-full text-left text-[10px] font-mono">
                <thead className="bg-sidebar border-b border-border text-muted-foreground sticky top-0">
                  <tr>
                    <th className="p-1.5">Zone Name</th>
                    <th className="p-1.5 text-right">Current</th>
                    <th className="p-1.5 text-right">Proposed</th>
                    <th className="p-1.5 text-right">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {proposedSplitPreview.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="p-1.5 font-medium">{item.name}</td>
                      <td className="p-1.5 text-right text-muted-foreground">
                        {item.currentSqm.toFixed(1)} m²
                      </td>
                      <td className="p-1.5 text-right font-semibold text-foreground">
                        {item.proposedSqm.toFixed(1)} m²
                      </td>
                      <td
                        className={`p-1.5 text-right font-semibold ${
                          item.diff > 0
                            ? "text-emerald-600"
                            : item.diff < 0
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.diff > 0 ? `+${item.diff.toFixed(1)}` : item.diff.toFixed(1)} m²
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-2 border border-blue-500/20 bg-blue-500/5 text-[10px] text-muted-foreground flex justify-between">
              <span>Total Proportional Sum:</span>
              <strong className="text-foreground">
                {proposedSplitPreview.reduce((acc, p) => acc + p.proposedSqm, 0).toFixed(1)} m² / {calibrationArea} m²
              </strong>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setShowSplitConfirmModal(false)}
              className="h-8 px-3 border border-border bg-background text-xs hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                handleRecalculateAreas(calibrationArea, true);
                setShowSplitConfirmModal(false);
                toast.success(`Applied proportional split based on ${calibrationArea} m² target.`);
              }}
              className="h-8 px-4 bg-foreground text-background text-xs hover:bg-foreground/90 font-medium"
            >
              Confirm & Apply Split
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
