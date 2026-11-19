import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { FloorPlan, RoomData } from "@/components/plinth/dashboard/floor-plan";
import { ToolButton } from "@/components/plinth/dashboard/ui";
import {
  FloorPlanAIDetection,
  AIImportRoom,
} from "@/components/plinth/dashboard/floorplan-ai-detection";
import {
  useProjects,
  useFloors,
  useCreateRoom,
  useImportRooms,
  useUpdateRoom,
  useDeleteRoom,
  useUpdateFloor,
} from "@/hooks/use-api";
import { Room } from "@/lib/api";
import {
  sqmToSqft,
  sqftToSqm,
  estimateRoomAreaSqm,
  computeBoxOverlap,
  separateOverlappingBoxes,
  computeScaleFromReference,
  calculateCalibratedRoomDimensions,
  validateCalibrationScale,
  getStandardScaleRatioString,
  isScaleCalibrationPlausible,
  resolveMeasurementStatus,
  getMeasurementStatusInfo,
  MIN_CALIBRATION_LINE_UNITS,
  convertDistanceToMeters,
  convertMetersToUnit,
  calculateFloorAreaBreakdown,
  validateRoomBoundaries,
  type ScaleCalibration,
  type MeasurementStatus,
  type CalibrationUnit,
} from "@/lib/geometry-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/floor-planner")({
  head: () => ({
    meta: [
      { title: "Floor Planner — PLINTH" },
      {
        name: "description",
        content:
          "Draw, measure and edit architectural plans with live areas, dimensions and room properties connected to real backend models.",
      },
    ],
  }),
  component: Planner,
});

const tools = [
  "Select",
  "Calibrate",
  "Room",
  "Wall",
  "Door",
  "Window",
  "Dimension",
  "Text",
];

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

interface RoomGeometry {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  orientation?: string;
  source?: string;
  confidence?: number;
  is_ai_estimate?: boolean;
  is_calibrated_calc?: boolean;
  is_manual?: boolean;
  measurement_status?: string;
  [key: string]: unknown;
}

const DEFAULT_ORIENTATIONS = ["NE", "E", "SE", "S", "SW", "W", "NW", "N"];

function mapRoomToRoomData(r: Room, index: number): RoomData {
  const geom = (r.geometry as RoomGeometry | null | undefined) ?? {};
  const col = index % 3;
  const row = Math.floor(index / 3);

  const x = typeof geom.x === "number" ? geom.x : 4 + col * 22;
  const y = typeof geom.y === "number" ? geom.y : 4 + row * 15;
  const w = typeof geom.w === "number" ? geom.w : 18;
  const h = typeof geom.h === "number" ? geom.h : 13;
  const orientation =
    typeof geom.orientation === "string"
      ? geom.orientation
      : DEFAULT_ORIENTATIONS[index % 8] ?? "NE";

  // Canonical unit is area_sqm (square metres)
  const area_sqm =
    r.area_sqm != null
      ? r.area_sqm
      : estimateRoomAreaSqm(w, h).areaSqm;

  // Display unit is whole square feet
  const area_sqft = sqmToSqft(area_sqm);

  const measurementStatus = resolveMeasurementStatus(geom, {
    isEstimate: Boolean(geom.is_ai_estimate || geom.source === "yolo_detector"),
    isCalibratedCalc: Boolean(geom.is_calibrated_calc),
    isManual: Boolean(geom.is_manual),
  });

  return {
    id: r.id,
    name: r.name,
    type: r.type,
    area: area_sqft,
    area_sqm,
    x,
    y,
    w,
    h,
    orientation,
    measurementStatus,
    isEstimate: measurementStatus === "ai_estimate",
    isCalibratedCalc: measurementStatus === "calibrated",
    isManual: measurementStatus === "user_corrected",
  };
}

function Planner() {
  const [tool, setTool] = useState("Select");
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(true);

  // Projects
  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useProjects();
  const projects = projectsData?.projects ?? [];
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const activeProjectId = selectedProjectId || (projects[0]?.id ?? "");
  const currentProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  // Real Floors from API
  const {
    data: floorsData,
    isLoading: floorsLoading,
    error: floorsError,
  } = useFloors(activeProjectId);

  const floors = floorsData?.floors ?? [];
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");

  // Determine active floor (default to Ground floor / level 0 if available, else first floor)
  const activeFloor = useMemo(() => {
    if (!floors.length) return null;
    if (selectedFloorId) {
      const found = floors.find((f) => f.id === selectedFloorId);
      if (found) return found;
    }
    const ground = floors.find((f) => f.level_number === 0);
    return ground || floors[0] || null;
  }, [floors, selectedFloorId]);

  // Calibration Scale extracted from activeFloor.plan_data
  const calibrationScale: ScaleCalibration | null = useMemo(() => {
    if (!activeFloor?.plan_data) return null;
    const scale = (activeFloor.plan_data as Record<string, unknown>)["scale"] as ScaleCalibration | undefined;
    if (scale && scale.isCalibrated) {
      const ratioString = scale.ratioString || getStandardScaleRatioString(scale.metersPerUnit);
      const isPlausible = isScaleCalibrationPlausible(scale.metersPerUnit);
      return { ...scale, ratioString, isPlausible };
    }
    return null;
  }, [activeFloor]);

  // Selected room ID
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Local rooms state for currently active floor to allow live editing & dragging
  const [roomList, setRoomList] = useState<RoomData[]>([]);

  // Scale Calibration Mode State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibPointA, setCalibPointA] = useState<{ x: number; y: number } | null>(null);
  const [calibPointB, setCalibPointB] = useState<{ x: number; y: number } | null>(null);
  const [showCalibModal, setShowCalibModal] = useState(false);
  const [calibKnownDistance, setCalibKnownDistance] = useState("");
  const [calibUnit, setCalibUnit] = useState<CalibrationUnit>("m");
  const [showOverwriteScaleConfirm, setShowOverwriteScaleConfirm] = useState(false);
  const [showApplyAreaConfirm, setShowApplyAreaConfirm] = useState(false);

  // Live validation for calibration parameters in modal
  const liveCalibValidation = useMemo(() => {
    if (!calibPointA || !calibPointB) return null;
    const rawVal = parseFloat(calibKnownDistance);
    if (isNaN(rawVal) || rawVal <= 0) return null;
    const meters = convertDistanceToMeters(rawVal, calibUnit);
    return validateCalibrationScale(calibPointA, calibPointB, meters);
  }, [calibPointA, calibPointB, calibKnownDistance, calibUnit]);

  // Architectural Floor Area Breakdown (Phase 4: Explicit 7-Metric Separation)
  const floorBreakdown = useMemo(() => {
    return calculateFloorAreaBreakdown(activeFloor?.area_sqm, roomList);
  }, [activeFloor?.area_sqm, roomList]);

  // Keep roomList in sync with activeFloor rooms
  useEffect(() => {
    if (!activeFloor) {
      setRoomList([]);
      setSelectedRoomId(null);
      return;
    }
    const mapped = (activeFloor.rooms ?? []).map(mapRoomToRoomData);
    setRoomList(mapped);
    if (mapped.length > 0 && mapped[0]) {
      const firstId = mapped[0].id;
      setSelectedRoomId((prev) => (mapped.some((r) => r.id === prev) ? prev : firstId));
    } else {
      setSelectedRoomId(null);
    }
  }, [activeFloor]);

  // Mutations
  const updateRoomMutation = useUpdateRoom(activeProjectId);
  const createRoomMutation = useCreateRoom(activeFloor?.id, activeProjectId);
  const importRoomsMutation = useImportRooms(activeFloor?.id, activeProjectId);
  const deleteRoomMutation = useDeleteRoom(activeProjectId);
  const updateFloorMutation = useUpdateFloor(activeProjectId);

  const currentRoom = roomList.find((r) => r.id === selectedRoomId);

  // Check if current room collides with another room on this floor (excluding normal shared partition walls)
  const currentRoomOverlaps = useMemo(() => {
    if (!currentRoom) return [];
    const overlaps: { name: string; ratio: number; otherId: string }[] = [];
    for (const other of roomList) {
      if (other.id === currentRoom.id) continue;
      const { isOverlapping, isSharedBoundary, ratio } = computeBoxOverlap(
        { x: currentRoom.x, y: currentRoom.y, w: currentRoom.w, h: currentRoom.h },
        { x: other.x, y: other.y, w: other.w, h: other.h }
      );
      if (isOverlapping && !isSharedBoundary) {
        overlaps.push({ name: other.name, ratio, otherId: other.id });
      }
    }
    return overlaps;
  }, [currentRoom, roomList]);

  // Boundary envelope validation (Phase 6: Architectural Validation)
  const currentRoomBoundary = useMemo(() => {
    if (!currentRoom) return null;
    return validateRoomBoundaries(currentRoom);
  }, [currentRoom]);

  function handleSeparateCurrentRoom() {
    if (!currentRoom || currentRoomOverlaps.length === 0) return;
    const separated = separateOverlappingBoxes(roomList.map((r) => ({ ...r })));
    const updated = separated.find((r) => r.id === currentRoom.id);
    if (updated) {
      handleUpdateRoom("x", updated.x);
      handleUpdateRoom("y", updated.y);
      toast.info(`Adjusted position of "${currentRoom.name}" to resolve collision.`);
    }
  }

  function handleUpdateRoom(field: keyof RoomData, value: unknown) {
    if (!selectedRoomId) return;
    setRoomList((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRoomId) return r;
        if (field === "area") {
          const sqft = Math.max(0, Number(value) || 0);
          return {
            ...r,
            area: sqft,
            area_sqm: sqftToSqm(sqft),
            isManual: true,
            isEstimate: false,
            isCalibratedCalc: false,
            measurementStatus: "user_corrected",
          };
        }
        if (field === "area_sqm") {
          const sqm = Math.max(0, Number(value) || 0);
          return {
            ...r,
            area_sqm: sqm,
            area: sqmToSqft(sqm),
            isManual: true,
            isEstimate: false,
            isCalibratedCalc: false,
            measurementStatus: "user_corrected",
          };
        }
        if (field === "measurementStatus") {
          const status = value as MeasurementStatus;
          return {
            ...r,
            measurementStatus: status,
            isEstimate: status === "ai_estimate",
            isCalibratedCalc: status === "calibrated",
            isManual: status === "user_corrected",
          };
        }
        if (field === "isEstimate") {
          const isEst = Boolean(value);
          const status: MeasurementStatus = isEst ? "ai_estimate" : "user_corrected";
          return {
            ...r,
            measurementStatus: status,
            isEstimate: isEst,
            isManual: !isEst,
          };
        }
        return { ...r, [field]: value };
      })
    );
  }

  // Interactive Live SVG Drag & Resize handlers
  function handleRoomCoordsLiveChange(id: string, coords: { x: number; y: number; w: number; h: number }) {
    setRoomList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...coords } : r))
    );
  }

  function handleRoomCoordsChangeEnd(id: string, coords: { x: number; y: number; w: number; h: number }) {
    const target = roomList.find((r) => r.id === id);
    if (!target) return;

    const dimChanged = target.w !== coords.w || target.h !== coords.h;
    let nextStatus = target.measurementStatus || "user_corrected";
    let nextAreaSqm = target.area_sqm != null ? target.area_sqm : sqftToSqm(target.area);
    let nextIsCalibCalc = target.isCalibratedCalc ?? false;

    // Phase 3 Invalidation / Recalculation:
    // If dimensions changed, check if a calibrated scale exists
    if (dimChanged) {
      if (calibrationScale?.isCalibrated && calibrationScale.isPlausible !== false) {
        const calibDims = calculateCalibratedRoomDimensions(coords.w, coords.h, calibrationScale.metersPerUnit);
        nextAreaSqm = calibDims.areaSqm;
        nextStatus = "calibrated";
        nextIsCalibCalc = true;
      } else {
        nextStatus = "user_corrected";
        nextIsCalibCalc = false;
      }
    }

    updateRoomMutation.mutate(
      {
        roomId: id,
        patch: {
          name: target.name,
          type: target.type || "room",
          area_sqm: nextAreaSqm,
          geometry: {
            x: coords.x,
            y: coords.y,
            w: coords.w,
            h: coords.h,
            orientation: target.orientation,
            is_ai_estimate: nextStatus === "ai_estimate",
            is_calibrated_calc: nextIsCalibCalc,
            is_manual: true,
            measurement_status: nextStatus,
          },
        },
      },
      {
        onSuccess: () => {
          toast.success(
            `Updated "${target.name}" geometry (${coords.w}×${coords.h}u${
              nextIsCalibCalc ? ` · ${nextAreaSqm} m² calibrated` : ""
            }).`
          );
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Failed to save room geometry";
          toast.error(msg);
        },
      }
    );
  }

  function handleSaveRoom() {
    if (!selectedRoomId || !currentRoom) return;

    const areaSqm = currentRoom.area_sqm != null ? currentRoom.area_sqm : sqftToSqm(currentRoom.area);

    updateRoomMutation.mutate(
      {
        roomId: selectedRoomId,
        patch: {
          name: currentRoom.name,
          type: currentRoom.type || "room",
          area_sqm: areaSqm,
          geometry: {
            x: currentRoom.x,
            y: currentRoom.y,
            w: currentRoom.w,
            h: currentRoom.h,
            orientation: currentRoom.orientation,
            is_ai_estimate: currentRoom.isEstimate ?? false,
            is_calibrated_calc: currentRoom.isCalibratedCalc ?? false,
            is_manual: currentRoom.isManual ?? true,
            measurement_status: currentRoom.measurementStatus || "user_corrected",
          },
        },
      },
      {
        onSuccess: (updated) => {
          toast.success(`Saved & synced "${updated.name}" to database!`);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Failed to save room: ${msg}`);
        },
      }
    );
  }

  function handleAddRoom() {
    if (!activeFloor) {
      toast.error("Please select a floor first.");
      return;
    }
    const nextIndex = roomList.length;
    const col = nextIndex % 3;
    const row = Math.floor(nextIndex / 3);
    const newGeom = {
      x: 4 + col * 22,
      y: 4 + row * 15,
      w: 18,
      h: 13,
      orientation: "NE",
      is_manual: true,
      is_ai_estimate: false,
    };

    createRoomMutation.mutate(
      {
        floorId: activeFloor.id,
        name: `Room 0${nextIndex + 1}`,
        type: "room",
        area_sqm: 14.0, // canonical 14 m² (~151 sq ft)
        geometry: newGeom,
      },
      {
        onSuccess: (newRoom) => {
          setSelectedRoomId(newRoom.id);
          toast.success(`Added "${newRoom.name}" to ${activeFloor.name}!`);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Failed to add room: ${msg}`);
        },
      }
    );
  }

  function handleDeleteRoom() {
    if (!selectedRoomId) return;
    const roomToDelete = roomList.find((r) => r.id === selectedRoomId);
    const roomName = roomToDelete?.name || "Room";

    deleteRoomMutation.mutate(selectedRoomId, {
      onSuccess: () => {
        setSelectedRoomId(null);
        toast.info(`Deleted "${roomName}" from floor plan.`);
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Failed to delete room: ${msg}`);
      },
    });
  }

  function handleSelectTool(t: string) {
    setTool(t);
    if (t === "Calibrate") {
      setIsCalibrating(true);
      setCalibPointA(null);
      setCalibPointB(null);
      toast.info("Calibration Mode: Click Point A on the plan to start reference line.");
    } else {
      setIsCalibrating(false);
      if (t === "Room") {
        handleAddRoom();
      } else if (t !== "Select") {
        toast.info(`Activated ${t} tool — click on canvas to place.`);
      }
    }
  }

  // Calibration canvas click handler
  function handleCalibrationCanvasClick(pt: { x: number; y: number }) {
    if (!calibPointA) {
      setCalibPointA(pt);
      toast.info(`Point A placed at (${pt.x}, ${pt.y}). Now click Point B to measure distance.`);
    } else if (!calibPointB) {
      const dist = Math.hypot(pt.x - calibPointA.x, pt.y - calibPointA.y);
      if (dist < MIN_CALIBRATION_LINE_UNITS) {
        toast.warning(
          `Reference line is too short (${dist.toFixed(1)} units < ${MIN_CALIBRATION_LINE_UNITS} min). Please select Point B further away.`
        );
        return;
      }
      setCalibPointB(pt);
      // Pre-fill with a nominal suggestion for this measured segment (e.g. dist * 0.1882m nominal)
      const nominalM = Math.round(dist * 0.1882 * 10) / 10;
      setCalibKnownDistance(nominalM > 0 ? nominalM.toString() : "");
      setCalibUnit("m");
      setShowCalibModal(true);
    }
  }

  async function handleApplyCalibration(forceOverwrite = false) {
    if (!activeFloor || !calibPointA || !calibPointB) return;
    const rawVal = parseFloat(calibKnownDistance);
    if (isNaN(rawVal) || rawVal <= 0) {
      toast.error("Please enter a valid positive distance.");
      return;
    }

    const meters = convertDistanceToMeters(rawVal, calibUnit);
    const validation = validateCalibrationScale(calibPointA, calibPointB, meters);
    if (!validation.isValid) {
      toast.error(validation.error || "Invalid calibration parameters.");
      return;
    }

    // Require explicit confirmation before overwriting an active calibrated scale
    if (calibrationScale?.isCalibrated && !forceOverwrite) {
      setShowOverwriteScaleConfirm(true);
      return;
    }

    try {
      const computedScale = computeScaleFromReference(calibPointA, calibPointB, meters);
      const scaleResult = {
        ...computedScale,
        inputDistance: rawVal,
        inputUnit: calibUnit,
        version: 2,
      };

      const existingPlanData = (activeFloor.plan_data as Record<string, unknown>) || {};

      await updateFloorMutation.mutateAsync({
        floorId: activeFloor.id,
        patch: {
          plan_data: {
            ...existingPlanData,
            scale: scaleResult,
          },
        },
      });

      setShowOverwriteScaleConfirm(false);
      setShowCalibModal(false);
      setIsCalibrating(false);
      setCalibPointA(null);
      setCalibPointB(null);
      setTool("Select");
      toast.success(
        `Scale calibrated! 1 unit = ${scaleResult.metersPerUnit.toFixed(3)}m (${scaleResult.ratioString}).`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Calibration failed";
      toast.error(msg);
    }
  }

  async function handleResetCalibration() {
    if (!activeFloor) return;
    const existingPlanData = { ...((activeFloor.plan_data as Record<string, unknown>) || {}) };
    delete existingPlanData["scale"];

    await updateFloorMutation.mutateAsync({
      floorId: activeFloor.id,
      patch: {
        plan_data: existingPlanData,
      },
    });

    setCalibPointA(null);
    setCalibPointB(null);
    setShowCalibModal(false);
    setIsCalibrating(false);
    setTool("Select");
    toast.info("Calibration reset to uncalibrated estimate.");
  }

  function handleConfirmApplyCalibratedArea() {
    if (!selectedRoomId || !currentRoom || !calibrationScale?.isCalibrated) return;

    const dims = calculateCalibratedRoomDimensions(
      currentRoom.w,
      currentRoom.h,
      calibrationScale.metersPerUnit
    );

    setShowApplyAreaConfirm(false);

    setRoomList((prev) =>
      prev.map((r) =>
        r.id === selectedRoomId
          ? {
              ...r,
              area_sqm: dims.areaSqm,
              area: dims.areaSqft,
              measurementStatus: "calibrated",
              isCalibratedCalc: true,
              isEstimate: false,
              isManual: false,
            }
          : r
      )
    );

    updateRoomMutation.mutate(
      {
        roomId: selectedRoomId,
        patch: {
          area_sqm: dims.areaSqm,
          geometry: {
            x: currentRoom.x,
            y: currentRoom.y,
            w: currentRoom.w,
            h: currentRoom.h,
            orientation: currentRoom.orientation,
            source: "calibrated_scale",
            is_ai_estimate: false,
            is_calibrated_calc: true,
            is_manual: false,
            measurement_status: "calibrated",
            calibrated_meters_per_unit: calibrationScale.metersPerUnit,
            calibrated_ratio_string: calibrationScale.ratioString,
            calibrated_at: calibrationScale.calibratedAt,
          },
        },
      },
      {
        onSuccess: () => {
          toast.success(
            `Applied calibrated area to "${currentRoom.name}": ${dims.areaSqm} m² (${dims.areaSqft} sq ft).`
          );
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Failed to update room area";
          toast.error(msg);
        },
      }
    );
  }

  const [isImportingRooms, setIsImportingRooms] = useState(false);

  async function handleImportDetectedRooms(importedRooms: AIImportRoom[]) {
    if (!activeFloor) {
      toast.error("Please select a floor first.");
      return;
    }
    if (importedRooms.length === 0) {
      toast.error("No approved rooms to import.");
      return;
    }

    setIsImportingRooms(true);
    try {
      const res = await importRoomsMutation.mutateAsync({
        floorId: activeFloor.id,
        rooms: importedRooms.map((r) => ({
          name: r.name,
          type: r.type,
          area_sqm: r.area_sqm,
          geometry: r.geometry,
        })),
      });

      const parts: string[] = [];
      if (res.imported_count > 0) parts.push(`imported ${res.imported_count} new room(s)`);
      if (res.updated_count > 0) parts.push(`updated ${res.updated_count} existing room(s)`);
      const summaryText = parts.length > 0 ? parts.join(", ") : "synced rooms";

      toast.success(
        `Successfully ${summaryText} on ${activeFloor.name}!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import rooms.";
      toast.error(`Import failed: ${msg}`);
      throw err;
    } finally {
      setIsImportingRooms(false);
    }
  }

  const isLoading = projectsLoading || floorsLoading;
  const hasError = projectsError || floorsError;

  const totalAreaSqft = roomList.reduce((acc, r) => acc + r.area, 0);
  const totalAreaSqm = roomList.reduce((acc, r) => acc + (r.area_sqm ?? sqftToSqm(r.area)), 0);

  // Calibrated room dimensions if available
  const calibratedCurrentRoomDims = useMemo(() => {
    if (!currentRoom || !calibrationScale?.isCalibrated) return null;
    return calculateCalibratedRoomDimensions(
      currentRoom.w,
      currentRoom.h,
      calibrationScale.metersPerUnit
    );
  }, [currentRoom, calibrationScale]);

  return (
    <div className="flex min-h-screen lg:h-[calc(100vh-3rem)] min-h-0 flex-col overflow-y-auto lg:overflow-hidden bg-background">
      {/* tool ribbon */}
      <div className="flex h-11 shrink-0 items-center gap-2 overflow-x-auto overflow-y-hidden border-b border-border px-3 bg-background select-none">
        {tools.map((t) => (
          <ToolButton key={t} active={tool === t} onClick={() => handleSelectTool(t)}>
            {t}
          </ToolButton>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <ToolButton active={grid} onClick={() => setGrid((g) => !g)}>
          Grid
        </ToolButton>
        <button
          onClick={handleAddRoom}
          disabled={!activeFloor || createRoomMutation.isPending}
          className="h-7 border border-foreground bg-foreground px-3 text-[11px] text-background transition-colors hover:bg-transparent hover:text-foreground disabled:opacity-50"
        >
          {createRoomMutation.isPending ? "Adding..." : "+ Add Room"}
        </button>

        {projects.length > 1 && (
          <div className="ml-2 flex items-center gap-1.5 border-l border-border pl-2">
            <span className="label-tech text-[10px]">Project:</span>
            <select
              value={activeProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedFloorId("");
                setSelectedRoomId(null);
              }}
              className="h-7 border border-border bg-background px-2 text-[11px] outline-none focus:border-foreground"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ToolButton onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>−</ToolButton>
          <span className="label-tech w-12 text-center">{Math.round(zoom * 100)}%</span>
          <ToolButton onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>+</ToolButton>
          <ToolButton onClick={() => setZoom(1)}>Fit</ToolButton>
        </div>
      </div>

      {/* AI Floor Plan Detection & Review Panel */}
      <FloorPlanAIDetection
        activeFloorName={activeFloor?.name}
        activeFloorId={activeFloor?.id}
        projectId={activeProjectId}
        floorAreaSqm={activeFloor?.area_sqm}
        existingRooms={activeFloor?.rooms || []}
        onImportRooms={handleImportDetectedRooms}
        isImporting={isImportingRooms}
      />

      {/* Architectural Area Breakdown Bar (Phase 4: Explicit 7-Metric Separation) */}
      {activeFloor && (
        <div className="flex flex-wrap items-center justify-between border-b border-border bg-sidebar/60 px-3 py-1.5 font-mono text-[10px] text-muted-foreground select-none">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-foreground/70 uppercase tracking-wider text-[9px]">Floor Envelope:</span>
              <span className="font-semibold text-foreground">
                {floorBreakdown.floorAreaSqm.toFixed(1)} m²
              </span>
              <span className="text-[9px]">({sqmToSqft(floorBreakdown.floorAreaSqm)} sq ft)</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-foreground/70 uppercase tracking-wider text-[9px]">Allocated Rooms:</span>
              <span className="font-semibold text-foreground">
                {floorBreakdown.roomsTotalAreaSqm.toFixed(1)} m²
              </span>
              <span className="text-[9px]">({floorBreakdown.allocatedPct}%)</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-foreground/70 uppercase tracking-wider text-[9px]">Circulation / Partitions:</span>
              <span className="font-semibold text-foreground">
                {floorBreakdown.unallocatedAreaSqm.toFixed(1)} m²
              </span>
              <span className="text-[9px]">({floorBreakdown.unallocatedPct}%)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/80">Breakdown:</span>
            {floorBreakdown.calibratedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-[9px] font-semibold">
                ✓ {floorBreakdown.calibratedCount} Calibrated ({floorBreakdown.calibratedAreaSqm.toFixed(1)} m²)
              </span>
            )}
            {floorBreakdown.userCorrectedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-600 text-[9px] font-semibold">
                ✎ {floorBreakdown.userCorrectedCount} User Corrected ({floorBreakdown.userCorrectedAreaSqm.toFixed(1)} m²)
              </span>
            )}
            {floorBreakdown.aiEstimateCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 text-[9px] font-semibold">
                ~ {floorBreakdown.aiEstimateCount} AI Est ({floorBreakdown.aiEstimateAreaSqm.toFixed(1)} m²)
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex min-h-[460px] flex-1 min-w-0 overflow-hidden">
        {/* floor selector */}
        <div className="hidden w-16 md:w-20 shrink-0 flex-col items-stretch border-r border-border bg-sidebar overflow-y-auto md:flex select-none">
          {isLoading ? (
            <div className="p-3 text-center font-mono text-[10px] text-muted-foreground">
              Loading...
            </div>
          ) : floors.length === 0 ? (
            <div className="p-3 text-center font-mono text-[10px] text-muted-foreground">
              No floors
            </div>
          ) : (
            floors.map((f) => {
              const isSelected = activeFloor?.id === f.id;
              const floorCode =
                f.level_number < 0
                  ? `B${Math.abs(f.level_number)}`
                  : `L0${f.level_number}`;
              const floorAreaSqFt = f.area_sqm
                ? `${sqmToSqft(f.area_sqm)} sf`
                : "—";

              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setSelectedFloorId(f.id);
                    setSelectedRoomId(null);
                  }}
                  title={f.name}
                  className={`border-b border-border px-1.5 py-3 text-center transition-colors ${
                    isSelected
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <span className="block font-mono text-[11px] font-semibold">{floorCode}</span>
                  <span
                    className="mt-0.5 block truncate text-[9px] opacity-80"
                    title={f.name}
                  >
                    {f.name}
                  </span>
                  <span className="mt-1 block font-mono text-[8px] opacity-60">
                    {floorAreaSqFt}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* central drawing canvas */}
        <div className="relative min-w-0 flex-1 min-h-0 overflow-hidden bg-background flex items-center justify-center">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center font-mono text-[12px] text-muted-foreground">
                <p>Loading architectural floor model...</p>
              </div>
            </div>
          ) : hasError ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div>
                <p className="font-mono text-[13px] text-destructive">
                  Unable to connect to backend model.
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ensure the API server is active and try reloading.
                </p>
              </div>
            </div>
          ) : !activeFloor ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div>
                <p className="font-mono text-[13px] text-muted-foreground">
                  No floor plan available for this project.
                </p>
              </div>
            </div>
          ) : (
            <div className={`relative h-full w-full flex items-center justify-center p-2 overflow-hidden ${grid ? "grid-paper" : ""}`}>
              {/* Calibration Instructions Floating Banner */}
              {isCalibrating && (
                <div className="absolute top-3 inset-x-0 mx-auto max-w-md z-20 bg-background/95 border border-blue-500 shadow-xl p-2.5 text-center backdrop-blur-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                      📏 Scale Calibration Mode
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCalibrating(false);
                        setCalibPointA(null);
                        setCalibPointB(null);
                        setTool("Select");
                      }}
                      className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
                    >
                      ✕ Cancel
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-foreground">
                    {!calibPointA
                      ? "Step 1: Click the first point (Point A) on a wall or reference."
                      : !calibPointB
                      ? `Point A marked at (${calibPointA.x}, ${calibPointA.y}). Click Point B.`
                      : "Points marked. Opening calibration dialog..."}
                  </p>
                </div>
              )}

              {/* Floor Plan SVG */}
              <FloorPlan
                selected={selectedRoomId}
                onSelect={setSelectedRoomId}
                zoom={zoom}
                roomList={roomList}
                onRoomChange={handleRoomCoordsLiveChange}
                onRoomChangeEnd={handleRoomCoordsChangeEnd}
                isCalibrating={isCalibrating}
                calibrationPoints={{ a: calibPointA, b: calibPointB }}
                onCalibrationClick={handleCalibrationCanvasClick}
                calibrationScale={calibrationScale}
              />

              {/* Bottom Dynamic Scale Bar */}
              <div className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-2.5 bg-background/90 backdrop-blur-sm border border-border px-3 py-1.5 shadow-sm text-[11px] font-mono select-none">
                {calibrationScale?.isCalibrated ? (
                  <>
                    {calibrationScale.isPlausible === false ? (
                      <span className="font-semibold text-amber-600 flex items-center gap-1" title="Scale factor (1u > 2.0m) exceeds typical bounds. Click Recalibrate to set reference line.">
                        ⚠️ Scale Needs Review · {calibrationScale.ratioString}
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-600 flex items-center gap-1">
                        ✓ Calibrated · {calibrationScale.ratioString}
                      </span>
                    )}
                    <span
                      className="block h-1 bg-foreground"
                      style={{
                        width: `${Math.max(16, Math.min(120, Math.round(1 * calibrationScale.unitsPerMeter * (12 / 1.05))))}px`,
                      }}
                    />
                    <span className="text-muted-foreground text-[10px]">1 000 mm</span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      (1u = {calibrationScale.metersPerUnit.toFixed(3)}m)
                    </span>
                    <span className="text-[9px] text-muted-foreground/70 font-mono">
                      · Viewport Zoom: {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTool("Calibrate");
                        setIsCalibrating(true);
                        setCalibPointA(null);
                        setCalibPointB(null);
                      }}
                      className="ml-2 text-[9px] text-muted-foreground hover:text-foreground underline"
                    >
                      Recalibrate
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-amber-600 font-medium">
                      ⚠️ Uncalibrated (Estimates Only)
                    </span>
                    <span className="block h-px w-14 bg-foreground/40" />
                    <span className="text-[10px] text-muted-foreground">1 000 mm (est)</span>
                    <span className="text-[9px] text-muted-foreground/70 font-mono">
                      · Viewport Zoom: {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTool("Calibrate");
                        setIsCalibrating(true);
                        setCalibPointA(null);
                        setCalibPointB(null);
                      }}
                      className="ml-2 text-[10px] text-foreground hover:underline font-semibold"
                    >
                      Calibrate Scale
                    </button>
                  </>
                )}
              </div>

              {/* Top-Left Canvas Title Badge */}
              <div className="pointer-events-none absolute top-3 left-3 bg-background/80 backdrop-blur-sm border border-border px-2 py-1">
                <span className="label-tech">
                  {currentProject?.name ? `${currentProject.name} · ` : ""}
                  {activeFloor.name} · {tool} tool · {roomList.length} Rooms
                </span>
              </div>

              {roomList.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="border border-border/80 bg-background/90 p-4 text-center backdrop-blur-sm">
                    <p className="font-mono text-[12px] text-foreground">
                      No rooms placed on {activeFloor.name} yet.
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Click &quot;+ Add Room&quot; above to create and place the first room.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* right properties panel */}
        <aside className="w-72 lg:w-80 shrink-0 flex flex-col min-h-0 overflow-y-auto border-l border-border bg-sidebar p-3 sm:p-4">
          <div className="mb-3 border-b border-border pb-2.5">
            <p className="label-tech">Room Properties</p>
            <p className="mt-0.5 text-[14px] font-medium truncate">
              {currentRoom ? currentRoom.name : "Select a room to edit"}
            </p>
            {activeFloor && (
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                Floor: {activeFloor.name}
              </p>
            )}
          </div>

          {currentRoom ? (
            <div className="space-y-3.5">
              {/* Collision / Overlap Warning Banner */}
              {currentRoomOverlaps.length > 0 && (
                <div className="border border-amber-500/40 bg-amber-500/10 p-2 font-mono text-[10px] text-amber-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">⚠️ Geometry Overlap Detected</span>
                    <span className="text-[9px] px-1 rounded bg-amber-500/20 font-bold">
                      {currentRoomOverlaps.map((o) => `${Math.round(o.ratio * 100)}%`).join(", ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] leading-tight">
                    Overlaps with <strong>{currentRoomOverlaps.map((o) => o.name).join(", ")}</strong>.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleSeparateCurrentRoom}
                      className="h-5 px-1.5 text-[9px] border border-amber-600/40 bg-background hover:bg-amber-500/15 text-amber-800 font-mono"
                    >
                      Nudge Apart
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteRoom}
                      className="h-5 px-1.5 text-[9px] border border-destructive/40 bg-background hover:bg-destructive/15 text-destructive font-mono"
                    >
                      Delete Duplicate
                    </button>
                  </div>
                </div>
              )}

              {/* Envelope Boundary Validation Warning */}
              {currentRoomBoundary?.isOutOfBounds && (
                <div className="border border-amber-500/40 bg-amber-500/10 p-2 font-mono text-[10px] text-amber-700">
                  <span className="font-semibold block mb-0.5">⚠️ Envelope Boundary Warning</span>
                  <div className="space-y-0.5 text-[9px]">
                    {currentRoomBoundary.violations.map((v, i) => (
                      <p key={i}>• {v}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Measurement Provenance Badge */}
              {(() => {
                const statusInfo = getMeasurementStatusInfo(currentRoom.measurementStatus || (currentRoom.isEstimate ? "ai_estimate" : currentRoom.isCalibratedCalc ? "calibrated" : "user_corrected"));
                return (
                  <div className="border border-border/80 bg-background/60 p-2 font-mono text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Measurement Status:</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${statusInfo.badgeClass}`}>
                        {statusInfo.badgeText}
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] text-muted-foreground leading-tight">
                      {statusInfo.description}
                    </p>
                    {currentRoom.measurementStatus === "ai_estimate" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateRoom("measurementStatus", "user_corrected")}
                        className="mt-1.5 h-5 px-1.5 text-[9px] border border-border bg-background hover:bg-muted font-mono"
                      >
                        ✓ Mark Verified
                      </button>
                    )}
                    {currentRoom.measurementStatus === "user_corrected" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateRoom("measurementStatus", "ai_estimate")}
                        className="mt-1.5 h-5 px-1.5 text-[9px] border border-border/60 bg-background hover:bg-muted font-mono text-muted-foreground"
                      >
                        Reset to AI Estimate
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Room Name & Type */}
              <div className="space-y-2">
                <div>
                  <label className="label-tech mb-1 block">Room Name</label>
                  <input
                    type="text"
                    value={currentRoom.name}
                    onChange={(e) => handleUpdateRoom("name", e.target.value)}
                    className="h-7 w-full border border-border bg-background px-2 text-[11px] font-mono outline-none focus:border-foreground"
                  />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Room Typology</label>
                  <select
                    value={currentRoom.type || "room"}
                    onChange={(e) => handleUpdateRoom("type", e.target.value)}
                    className="h-7 w-full border border-border bg-background px-2 text-[11px] font-mono outline-none focus:border-foreground"
                  >
                    {ROOM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Real-World Dimensions & Calibrated Area Box */}
              {calibrationScale?.isCalibrated && calibratedCurrentRoomDims ? (
                <div className="border border-emerald-500/30 bg-emerald-500/5 p-2.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-emerald-800 font-semibold">
                    <span>Verified Real Dimensions</span>
                    <span className="text-[9px] bg-emerald-500/15 px-1 rounded">
                      {calibrationScale.ratioString}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-foreground text-[11px]">
                    <div>
                      <span className="text-[9px] text-muted-foreground block">Width</span>
                      <strong>{calibratedCurrentRoomDims.widthM} m</strong>
                      <span className="text-[9px] text-muted-foreground ml-1">
                        ({Math.round(calibratedCurrentRoomDims.widthM * 3.28084 * 10) / 10} ft)
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block">Height</span>
                      <strong>{calibratedCurrentRoomDims.heightM} m</strong>
                      <span className="text-[9px] text-muted-foreground ml-1">
                        ({Math.round(calibratedCurrentRoomDims.heightM * 3.28084 * 10) / 10} ft)
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-emerald-500/20 flex items-center justify-between">
                    <span className="text-muted-foreground">Calibrated Area:</span>
                    <strong>
                      {calibratedCurrentRoomDims.areaSqm} m² ({calibratedCurrentRoomDims.areaSqft} sq ft)
                    </strong>
                  </div>
                  {showApplyAreaConfirm ? (
                    <div className="mt-2.5 p-2 border border-emerald-600/40 bg-emerald-500/10 space-y-1.5 font-mono text-[10px]">
                      <p className="font-semibold text-emerald-900 flex items-center gap-1">
                        ⚠️ Confirm Area Update?
                      </p>
                      <p className="text-[9px] text-foreground leading-tight">
                        Current: <strong>{currentRoom.area_sqm ?? sqftToSqm(currentRoom.area)} m²</strong> ({currentRoom.area} sq ft)
                        <br />
                        Calibrated: <strong>{calibratedCurrentRoomDims.areaSqm} m²</strong> ({calibratedCurrentRoomDims.areaSqft} sq ft)
                      </p>
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={handleConfirmApplyCalibratedArea}
                          disabled={updateRoomMutation.isPending}
                          className="h-6 flex-1 bg-emerald-700 text-white hover:bg-emerald-800 text-[10px] font-bold transition-colors"
                        >
                          {updateRoomMutation.isPending ? "Applying..." : "Confirm & Apply"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowApplyAreaConfirm(false)}
                          className="h-6 px-2 border border-border bg-background hover:bg-muted text-[10px] text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowApplyAreaConfirm(true)}
                      className="mt-2 w-full h-6 border border-emerald-600/40 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-900 text-[10px] font-mono font-medium transition-colors"
                    >
                      Apply Calibrated Area to Room
                    </button>
                  )}
                </div>
              ) : (
                <div className="border border-border/80 bg-background/50 p-2 font-mono text-[10px] text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Scale: Uncalibrated</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTool("Calibrate");
                        setIsCalibrating(true);
                      }}
                      className="text-[9px] underline text-foreground font-semibold"
                    >
                      Calibrate Plan
                    </button>
                  </div>
                  <p className="mt-1 text-[9px] leading-tight">
                    Calibrate two reference points to compute real-world metres and verified area.
                  </p>
                </div>
              )}

              {/* Area Measurements: Synchronized Canonical (m²) & Display (sq ft) Units */}
              <div className="border-t border-border/60 pt-2.5">
                <p className="label-tech mb-1.5">Area Measurements</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className="label-tech text-[9px] mb-0.5 block">Area (sq ft)</label>
                    <input
                      type="number"
                      min={0}
                      value={currentRoom.area}
                      onChange={(e) => handleUpdateRoom("area", Number(e.target.value))}
                      className="h-7 w-full border border-border bg-background px-2 font-mono text-[11px] outline-none focus:border-foreground"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="label-tech text-[9px] mb-0.5 block">Area (m²)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={currentRoom.area_sqm ?? sqftToSqm(currentRoom.area)}
                      onChange={(e) => handleUpdateRoom("area_sqm", Number(e.target.value))}
                      className="h-7 w-full border border-border bg-background px-2 font-mono text-[11px] outline-none focus:border-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Position & Geometry Inputs (X, Y, W, H in units) */}
              <div className="border-t border-border/60 pt-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="label-tech">Canvas Geometry (Units)</p>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    Drag on canvas to edit
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="min-w-0">
                    <label className="label-tech text-[9px] mb-0.5 block">Pos X (units)</label>
                    <input
                      type="number"
                      min={0}
                      max={70}
                      value={currentRoom.x}
                      onChange={(e) => handleUpdateRoom("x", Number(e.target.value))}
                      className="h-7 w-full border border-border bg-background px-2 font-mono text-[11px] outline-none focus:border-foreground"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="label-tech text-[9px] mb-0.5 block">Pos Y (units)</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={currentRoom.y}
                      onChange={(e) => handleUpdateRoom("y", Number(e.target.value))}
                      className="h-7 w-full border border-border bg-background px-2 font-mono text-[11px] outline-none focus:border-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className="label-tech text-[9px] mb-0.5 block">Width (units)</label>
                    <input
                      type="number"
                      min={4}
                      value={currentRoom.w}
                      onChange={(e) => handleUpdateRoom("w", Number(e.target.value))}
                      className="h-7 w-full border border-border bg-background px-2 font-mono text-[11px] outline-none focus:border-foreground"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="label-tech text-[9px] mb-0.5 block">Height (units)</label>
                    <input
                      type="number"
                      min={4}
                      value={currentRoom.h}
                      onChange={(e) => handleUpdateRoom("h", Number(e.target.value))}
                      className="h-7 w-full border border-border bg-background px-2 font-mono text-[11px] outline-none focus:border-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Orientation */}
              <div>
                <label className="label-tech mb-1 block">Orientation</label>
                <select
                  value={currentRoom.orientation}
                  onChange={(e) => handleUpdateRoom("orientation", e.target.value)}
                  className="h-7 w-full border border-border bg-background px-2 text-[11px] font-mono outline-none focus:border-foreground"
                >
                  {DEFAULT_ORIENTATIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              {/* Save & Sync Button */}
              <div className="border-t border-border pt-3">
                <button
                  onClick={handleSaveRoom}
                  disabled={updateRoomMutation.isPending}
                  className="h-8 w-full border border-foreground bg-foreground text-[10px] uppercase tracking-wider text-background transition-colors hover:bg-transparent hover:text-foreground disabled:opacity-50"
                >
                  {updateRoomMutation.isPending ? "Saving..." : "Save & Sync Model"}
                </button>
              </div>

              {/* Delete Room */}
              <div className="border-t border-border pt-2">
                <button
                  onClick={handleDeleteRoom}
                  disabled={deleteRoomMutation.isPending}
                  className="h-7 w-full border border-destructive/40 text-[10px] uppercase tracking-wider text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                >
                  {deleteRoomMutation.isPending ? "Deleting..." : "Delete Room"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center border border-dashed border-border/80 p-4 text-center">
              <p className="font-mono text-[11px] text-muted-foreground">
                Click on any room in the floor plan to edit geometry, resize boundaries, or adjust areas.
              </p>
            </div>
          )}

          {/* Floor Summary Footer */}
          {activeFloor && (
            <div className="mt-auto border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Rooms on Floor:</span>
                <span className="font-semibold text-foreground">{roomList.length}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Total Floor Area:</span>
                <span className="font-semibold text-foreground">
                  {totalAreaSqft.toLocaleString()} sq ft ({totalAreaSqm.toFixed(1)} m²)
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Scale Status:</span>
                <span className={calibrationScale?.isCalibrated ? "text-emerald-600 font-semibold" : "text-amber-600"}>
                  {calibrationScale?.isCalibrated ? `✓ Calibrated (${calibrationScale.ratioString})` : "Uncalibrated"}
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Scale Calibration Dialog */}
      <Dialog open={showCalibModal} onOpenChange={setShowCalibModal}>
        <DialogContent className="sm:max-w-md font-mono bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold tracking-wide">
              Scale Calibration (2-Point Reference)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter the known real-world dimension between Point A and Point B to calibrate drawing coordinates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2 p-2 bg-muted/40 border border-border">
              <div>
                <span className="text-muted-foreground block text-[10px]">Point A (Canvas)</span>
                <span className="font-bold">({calibPointA?.x}, {calibPointA?.y}) units</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Point B (Canvas)</span>
                <span className="font-bold">({calibPointB?.x}, {calibPointB?.y}) units</span>
              </div>
            </div>

            <div className="p-2 border border-blue-500/30 bg-blue-500/5 flex items-center justify-between">
              <div>
                <span className="text-muted-foreground text-[10px] block">Measured Canvas Reference Line:</span>
                <span className="font-bold text-sm text-blue-700">
                  {calibPointA && calibPointB ? Math.hypot(calibPointB.x - calibPointA.x, calibPointB.y - calibPointA.y).toFixed(2) : 0} units
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                Min: {MIN_CALIBRATION_LINE_UNITS} units
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">
                Enter Known Physical Distance for this Measured Line
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0.01}
                  step={0.1}
                  value={calibKnownDistance}
                  onChange={(e) => setCalibKnownDistance(e.target.value)}
                  className="flex-1 h-8 px-2 border border-border bg-background text-xs outline-none focus:border-foreground"
                  placeholder="e.g. 5.0"
                />
                <select
                  value={calibUnit}
                  onChange={(e) => setCalibUnit(e.target.value as CalibrationUnit)}
                  className="h-8 px-2 border border-border bg-background text-xs outline-none focus:border-foreground"
                >
                  <option value="m">Metres (m)</option>
                  <option value="cm">Centimetres (cm)</option>
                  <option value="mm">Millimetres (mm)</option>
                  <option value="ft">Feet (ft)</option>
                </select>
              </div>
            </div>

            {/* Overwrite Confirmation Alert (Phase 2: Explicit Confirmation Before Overwriting Active Scale) */}
            {showOverwriteScaleConfirm && (
              <div className="p-3 border border-amber-500/50 bg-amber-500/10 space-y-2 text-xs">
                <p className="font-semibold text-amber-700">⚠️ Existing Scale Already Configured</p>
                <p className="text-[11px] text-foreground leading-relaxed">
                  Floor currently has scale {calibrationScale?.ratioString} (1 unit = {calibrationScale?.metersPerUnit.toFixed(3)}m).
                  Are you sure you want to replace it with <strong>{liveCalibValidation?.ratioString} (1 unit = {liveCalibValidation?.metersPerUnit.toFixed(3)}m)</strong>?
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowOverwriteScaleConfirm(false)}
                    className="h-7 px-2 border border-border bg-background text-[11px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCalibration(true)}
                    className="h-7 px-3 bg-amber-600 text-white text-[11px] font-semibold hover:bg-amber-700"
                  >
                    Confirm & Overwrite Scale
                  </button>
                </div>
              </div>
            )}

            {/* Live Scale Preview & Validation Feedback */}
            {liveCalibValidation && (
              <div className="space-y-2 pt-1">
                {!liveCalibValidation.isValid ? (
                  <div className="p-2.5 border border-destructive/50 bg-destructive/10 text-destructive text-[11px] leading-relaxed">
                    <p className="font-bold flex items-center gap-1">⚠️ Cannot Apply Scale</p>
                    <p className="mt-0.5">{liveCalibValidation.error}</p>
                  </div>
                ) : (
                  <div className="p-2.5 border border-emerald-500/40 bg-emerald-500/10 space-y-2 text-[10px]">
                    <div className="flex items-center justify-between text-emerald-800 font-semibold">
                      <span className="flex items-center gap-1">✓ Plausible Drawing Scale</span>
                      <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {liveCalibValidation.ratioString}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-foreground text-[11px]">
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Conversion factor:</span>
                        <strong>1 unit = {liveCalibValidation.metersPerUnit.toFixed(3)} m</strong>
                        <span className="text-[9px] text-muted-foreground block">
                          ({Math.round(liveCalibValidation.metersPerUnit * 1000)} mm / {Math.round(liveCalibValidation.metersPerUnit * 3.28084 * 10) / 10} ft)
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Building Envelope (76×54u):</span>
                        <strong>{liveCalibValidation.envelopeWidthM}m × {liveCalibValidation.envelopeHeightM}m</strong>
                        <span className="text-[9px] text-muted-foreground block">
                          (~{liveCalibValidation.envelopeAreaSqm} m² / {sqmToSqft(liveCalibValidation.envelopeAreaSqm)} sq ft)
                        </span>
                      </div>
                    </div>
                    {liveCalibValidation.warning && (
                      <p className="text-amber-700 text-[9px] pt-1 border-t border-emerald-500/20">
                        ⚠️ {liveCalibValidation.warning}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {calibrationScale?.isCalibrated && !showOverwriteScaleConfirm && (
              <button
                type="button"
                onClick={handleResetCalibration}
                className="h-8 px-3 border border-destructive/40 text-destructive text-xs hover:bg-destructive/10"
              >
                Reset Scale
              </button>
            )}
            {!showOverwriteScaleConfirm && (
              <button
                type="button"
                onClick={() => handleApplyCalibration(false)}
                disabled={!liveCalibValidation?.isValid || updateFloorMutation.isPending}
                className="h-8 px-4 bg-foreground text-background text-xs hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {updateFloorMutation.isPending ? "Saving..." : "Apply & Verify Scale"}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
