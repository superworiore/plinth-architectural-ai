/**
 * PLINTH API client — handles auth tokens and typed fetch calls.
 * Backend runs at http://127.0.0.1:8000
 */

const API_BASE = (import.meta.env["VITE_API_URL"] as string) || "http://127.0.0.1:8000";

// ── Token management ────────────────────────────────────────────────────

let token: string | null = null;

export function getToken(): string | null {
  if (token) return token;
  if (typeof window !== "undefined" && typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
    try {
      token = localStorage.getItem("plinth_token");
    } catch {
      return null;
    }
  }
  return token;
}

export function setToken(t: string) {
  token = t;
  if (typeof window !== "undefined" && typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
    try {
      localStorage.setItem("plinth_token", t);
    } catch {
      // ignore
    }
  }
}

export function clearToken() {
  token = null;
  if (typeof window !== "undefined" && typeof localStorage !== "undefined" && typeof localStorage.removeItem === "function") {
    try {
      localStorage.removeItem("plinth_token");
    } catch {
      // ignore
    }
  }
}

// ── Fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    let message = `API ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") {
        message = data.detail;
      } else if (data && typeof data.detail === "object") {
        message = JSON.stringify(data.detail);
      }
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export const auth = {
  signup: (email: string, password: string, full_name: string) =>
    apiFetch<TokenResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),

  login: (email: string, password: string) =>
    apiFetch<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => apiFetch<UserResponse>("/api/auth/me"),
};

// ── Projects ─────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  code: string;
  org_id: string | null;
  status: string;
  typology: string;
  location: string | null;
  plot_data: Record<string, unknown> | null;
  budget: number | null;
  spent: number | null;
  progress: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const projects = {
  list: () => apiFetch<{ projects: Project[]; total: number }>("/api/projects/"),
  get: (id: string) => apiFetch<Project>(`/api/projects/${id}`),
  create: (data: { name: string; code: string; typology?: string; location?: string; budget?: number }) =>
    apiFetch<Project>("/api/projects/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Project>) =>
    apiFetch<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/api/projects/${id}`, { method: "DELETE" }),
};

// ── Floors ────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  floor_id: string;
  name: string;
  type: string;
  area_sqm: number | null;
  geometry: Record<string, unknown> | null;
  materials: Record<string, unknown> | null;
}

export interface Floor {
  id: string;
  project_id: string;
  level_number: number;
  name: string;
  area_sqm: number | null;
  plan_data: Record<string, unknown> | null;
  created_at: string;
  rooms: Room[];
}

export interface RoomBatchImportResponse {
  imported_count: number;
  updated_count: number;
  rooms: Room[];
}

export const floors = {
  list: (projectId: string) =>
    apiFetch<{ floors: Floor[]; total: number }>(`/api/projects/${projectId}/floors`),
  get: (id: string) => apiFetch<Floor>(`/api/floors/${id}`),
  update: (floorId: string, data: Partial<{ name: string; level_number: number; area_sqm: number; plan_data: Record<string, unknown> }>) =>
    apiFetch<Floor>(`/api/floors/${floorId}`, { method: "PATCH", body: JSON.stringify(data) }),
  create: (projectId: string, data: { level_number: number; name: string; area_sqm?: number }) =>
    apiFetch<Floor>(`/api/projects/${projectId}/floors`, { method: "POST", body: JSON.stringify(data) }),
  createRoom: (floorId: string, data: { name: string; type: string; area_sqm?: number; geometry?: Record<string, unknown>; materials?: Record<string, unknown> }) =>
    apiFetch<Room>(`/api/floors/${floorId}/rooms`, { method: "POST", body: JSON.stringify(data) }),
  importRooms: (floorId: string, rooms: { name: string; type: string; area_sqm?: number; geometry?: Record<string, unknown>; materials?: Record<string, unknown> }[]) =>
    apiFetch<RoomBatchImportResponse>(`/api/floors/${floorId}/import-rooms`, { method: "POST", body: JSON.stringify({ rooms }) }),
  updateRoom: (roomId: string, data: Partial<{ name: string; type: string; area_sqm: number; geometry: Record<string, unknown>; materials: Record<string, unknown> }>) =>
    apiFetch<Room>(`/api/rooms/${roomId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRoom: (roomId: string) =>
    apiFetch<void>(`/api/rooms/${roomId}`, { method: "DELETE" }),
};

// ── Costs ─────────────────────────────────────────────────────────────────

export interface CostItem {
  id: string;
  project_id: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unit_rate: number;
  total: number;
}

export interface CostSummary {
  total_budget: number | null;
  total_spent: number;
  total_estimated: number;
  variance_percent: number;
  by_category: { category: string; total: number; percent: number }[];
}

export const costs = {
  list: (projectId: string) =>
    apiFetch<{ items: CostItem[]; summary: CostSummary }>(`/api/projects/${projectId}/costs`),
  create: (projectId: string, data: { category: string; description: string; quantity: number; unit: string; unit_rate: number }) =>
    apiFetch<CostItem>(`/api/projects/${projectId}/costs`, { method: "POST", body: JSON.stringify(data) }),
  update: (costId: string, data: Partial<{ category: string; description: string; quantity: number; unit: string; unit_rate: number }>) =>
    apiFetch<CostItem>(`/api/costs/${costId}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (costId: string) =>
    apiFetch<void>(`/api/costs/${costId}`, { method: "DELETE" }),
};

// ── Documents & File Uploads ──────────────────────────────────────────────

export interface Document {
  id: string;
  project_id: string;
  title: string;
  type: string;
  file_url: string | null;
  version: number;
  uploaded_by: string;
  created_at: string;
}

export const documents = {
  list: (projectId: string) =>
    apiFetch<{ documents: Document[]; total: number }>(`/api/projects/${projectId}/documents`),
  
  upload: async (projectId: string, file: File, docType: string = "other"): Promise<Document> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", docType);

    const t = getToken();
    const headers: Record<string, string> = {};
    if (t) headers["Authorization"] = `Bearer ${t}`;

    const res = await fetch(`${API_BASE}/api/projects/${projectId}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
    return res.json();
  },
};

// ── Compliance ────────────────────────────────────────────────────────────

export interface ComplianceCheck {
  id: string;
  project_id: string;
  rule_code: string;
  description: string;
  status: string;
  detail: string | null;
  checked_at: string;
}

export const compliance = {
  list: (projectId: string) =>
    apiFetch<{ checks: ComplianceCheck[]; passing: number; failing: number; in_review: number; not_checked: number }>(
      `/api/projects/${projectId}/compliance`
    ),
  run: (projectId: string) =>
    apiFetch<{ checks: ComplianceCheck[]; passing: number; failing: number; in_review: number; not_checked: number }>(
      `/api/projects/${projectId}/compliance/run`,
      { method: "POST" }
    ),
};

// ── Activity ──────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  extra_data: Record<string, unknown> | null;
  created_at: string;
  user_name: string | null;
  user_role: string | null;
}

export const activity = {
  list: (projectId: string) =>
    apiFetch<{ activities: Activity[]; total: number }>(`/api/projects/${projectId}/activity`),
};

// ── AI Modules ────────────────────────────────────────────────────────────

export interface AssistantResponse {
  reply: string;
  context_used: string[];
}

export interface PlotAnalysis {
  location: string;
  zone: string;
  max_far: number;
  max_height_m: number;
  setbacks: Record<string, number>;
  buildable_area_sqm: number;
  solar_orientation: string;
  terrain: string;
  recommendations: string[];
}

export interface CostEstimate {
  total_estimated: number;
  cost_per_sqft: number;
  breakdown: { category: string; amount: number; percent: number; rate_per_sqft: number }[];
  recommendations: string[];
}

export interface FloorplanDetection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox_xyxy: [number, number, number, number];
  bbox_norm?: [number, number, number, number];
}

export interface FloorplanDetectionResponse {
  success: boolean;
  filename: string;
  image_width: number;
  image_height: number;
  detection_count: number;
  detections: FloorplanDetection[];
  annotated_image: string;
  model?: string;
  note?: string;
}

export const ai = {
  assistant: (projectId: string, message: string, history: { role: string; content: string }[] = []) =>
    apiFetch<AssistantResponse>("/api/ai/assistant", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, message, history }),
    }),

  plotAnalysis: (latitude: number, longitude: number, plot_area_sqm?: number) =>
    apiFetch<PlotAnalysis>("/api/ai/plot-analysis", {
      method: "POST",
      body: JSON.stringify({ latitude, longitude, plot_area_sqm }),
    }),

  costEstimate: (projectId: string) =>
    apiFetch<CostEstimate>("/api/ai/cost-estimate", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId }),
    }),

  detectFloorplan: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiUpload<FloorplanDetectionResponse>("/api/ai/floorplan/detect", formData);
  },
};
