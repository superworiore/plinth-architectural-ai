/**
 * TanStack Query hooks for PLINTH API data.
 * These replace the hardcoded imports from plinth-data.ts.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  projects as projectsApi,
  floors as floorsApi,
  costs as costsApi,
  documents as documentsApi,
  compliance as complianceApi,
  activity as activityApi,
  ai as aiApi,
  getToken,
} from "@/lib/api";

// ── Projects ─────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
    enabled: !!getToken(),
    staleTime: 30_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectsApi.get(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; code: string; typology?: string; location?: string; budget?: number }) =>
      projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ name: string; code: string; typology: string; status: string; location: string; plot_data: Record<string, unknown>; budget: number; spent: number; progress: number }>) =>
      projectsApi.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// ── Floors ────────────────────────────────────────────────────────────────

export function useFloors(projectId: string) {
  return useQuery({
    queryKey: ["floors", projectId],
    queryFn: () => floorsApi.list(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useFloor(id: string) {
  return useQuery({
    queryKey: ["floor", id],
    queryFn: () => floorsApi.get(id),
    enabled: !!id,
  });
}

export function useUpdateFloor(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ floorId, patch }: { floorId: string; patch: Partial<{ name: string; level_number: number; area_sqm: number; plan_data: Record<string, unknown> }> }) =>
      floorsApi.update(floorId, patch),
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["floors", projectId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["floors"] });
      }
    },
  });
}

export function useCreateRoom(floorId?: string, projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { floorId?: string; name: string; type: string; area_sqm?: number; geometry?: Record<string, unknown>; materials?: Record<string, unknown> }) => {
      const targetFloorId = data.floorId || floorId;
      if (!targetFloorId) throw new Error("Floor ID is required to create a room");
      const { floorId: _, ...roomData } = data;
      return floorsApi.createRoom(targetFloorId, roomData);
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["floors", projectId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["floors"] });
      }
    },
  });
}

export function useImportRooms(floorId?: string, projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { floorId?: string; rooms: { name: string; type: string; area_sqm?: number; geometry?: Record<string, unknown>; materials?: Record<string, unknown> }[] }) => {
      const targetFloorId = data.floorId || floorId;
      if (!targetFloorId) throw new Error("Floor ID is required to import rooms");
      return floorsApi.importRooms(targetFloorId, data.rooms);
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["floors", projectId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["floors"] });
      }
    },
  });
}

export function useUpdateRoom(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { roomId: string; patch: Partial<{ name: string; type: string; area_sqm: number; geometry: Record<string, unknown>; materials: Record<string, unknown> }> }) =>
      floorsApi.updateRoom(data.roomId, data.patch),
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["floors", projectId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["floors"] });
      }
    },
  });
}

export function useDeleteRoom(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => floorsApi.deleteRoom(roomId),
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["floors", projectId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["floors"] });
      }
    },
  });
}

// ── Costs ─────────────────────────────────────────────────────────────────

export function useCosts(projectId: string) {
  return useQuery({
    queryKey: ["costs", projectId],
    queryFn: () => costsApi.list(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useCreateCostItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { category: string; description: string; quantity: number; unit: string; unit_rate: number }) =>
      costsApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costs", projectId] });
    },
  });
}

export function useUpdateCostItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { costId: string; patch: Partial<{ category: string; description: string; quantity: number; unit: string; unit_rate: number }> }) =>
      costsApi.update(data.costId, data.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costs", projectId] });
    },
  });
}

export function useDeleteCostItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (costId: string) => costsApi.delete(costId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costs", projectId] });
    },
  });
}

// ── Documents & File Uploads ──────────────────────────────────────────────

export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: ["documents", projectId],
    queryFn: () => documentsApi.list(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useUploadDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { file: File; docType?: string }) =>
      documentsApi.upload(projectId, data.file, data.docType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", projectId] });
    },
  });
}

// ── Compliance ────────────────────────────────────────────────────────────

export function useCompliance(projectId: string) {
  return useQuery({
    queryKey: ["compliance", projectId],
    queryFn: () => complianceApi.list(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useRunCompliance(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => complianceApi.run(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", projectId] });
    },
  });
}

// ── Activity ──────────────────────────────────────────────────────────────

export function useActivity(projectId: string) {
  return useQuery({
    queryKey: ["activity", projectId],
    queryFn: () => activityApi.list(projectId),
    enabled: !!projectId,
    staleTime: 10_000,
  });
}

// ── AI Assistant ──────────────────────────────────────────────────────────

export function useAiAssistant(projectId: string) {
  return useMutation({
    mutationFn: (message: string) => aiApi.assistant(projectId, message),
  });
}

// ── AI Plot Analysis ──────────────────────────────────────────────────────

export function useAiPlotAnalysis() {
  return useMutation({
    mutationFn: (data: { latitude: number; longitude: number; plot_area_sqm?: number }) =>
      aiApi.plotAnalysis(data.latitude, data.longitude, data.plot_area_sqm),
  });
}

// ── AI Cost Estimate ──────────────────────────────────────────────────────

export function useAiCostEstimate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => aiApi.costEstimate(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costs", projectId] });
    },
  });
}

// ── AI Floorplan Detection ────────────────────────────────────────────────

export function useDetectFloorplan() {
  return useMutation({
    mutationFn: (file: File) => aiApi.detectFloorplan(file),
  });
}

