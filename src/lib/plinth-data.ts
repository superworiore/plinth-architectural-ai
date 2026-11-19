// Frontend-only mock data for the PLINTH product surfaces.

export const project = {
  id: "PRJ-2261",
  name: "Residence 01",
  client: "N. Varma",
  location: "Bengaluru, KA",
  plot: "40 × 60 ft · 2,400 sq ft",
  typology: "G+2 Residential",
  progress: 0.62,
  currentFloor: "Level 01 — Living",
  cost: { estimate: 18420000, spent: 9860000, variance: -0.032, currency: "INR" },
  updated: "Today, 14:20",
};

export const metrics = [
  { label: "Design", value: "Schematic — 78%", state: "active" as const, ratio: 0.78 },
  { label: "Compliance", value: "3 open items", state: "warn" as const, ratio: 0.71 },
  { label: "Materials", value: "24 of 31 specified", state: "ok" as const, ratio: 0.77 },
  { label: "Documents", value: "Set B issued", state: "ok" as const, ratio: 0.55 },
];

export const floors = [
  { id: "L02", name: "Level 02", area: 1180, rooms: 5 },
  { id: "L01", name: "Level 01", area: 1240, rooms: 6 },
  { id: "L00", name: "Ground", area: 1240, rooms: 7 },
  { id: "B01", name: "Basement", area: 860, rooms: 3 },
];

export const rooms = [
  { id: "R-01", name: "Living", area: 322, x: 4, y: 4, w: 30, h: 22, orientation: "NE" },
  { id: "R-02", name: "Dining", area: 186, x: 34, y: 4, w: 20, h: 18, orientation: "E" },
  { id: "R-03", name: "Kitchen", area: 148, x: 54, y: 4, w: 18, h: 16, orientation: "SE" },
  { id: "R-04", name: "Bedroom 01", area: 214, x: 4, y: 26, w: 22, h: 20, orientation: "SW" },
  { id: "R-05", name: "Bedroom 02", area: 196, x: 26, y: 26, w: 20, h: 20, orientation: "S" },
  { id: "R-06", name: "Utility", area: 92, x: 54, y: 20, w: 18, h: 12, orientation: "W" },
];

export const activity = [
  { t: "14:20", who: "A. Rao", role: "Architect", what: "Revised Level 01 wall thickness to 230mm" },
  { t: "12:04", who: "PLINTH", role: "Intelligence", what: "Cost variance detected in joinery package (−3.2%)" },
  { t: "11:31", who: "S. Iyer", role: "Interior", what: "Approved material palette — Warm Travertine" },
  { t: "09:58", who: "M. Khan", role: "Engineer", what: "Uploaded structural set S-04 rev C" },
  { t: "Yesterday", who: "PLINTH", role: "Compliance", what: "Setback on north edge below 1.5m minimum" },
];

export const recommendations = [
  { title: "Rotate Bedroom 02 axis by 90°", detail: "Improves cross-ventilation and gains 18 sq ft usable area.", tag: "Layout" },
  { title: "Substitute joinery veneer", detail: "Local oak-finish ply reduces package cost by ₹142,000.", tag: "Cost" },
  { title: "Increase north setback to 1.5m", detail: "Resolves the open compliance item on the site plan.", tag: "Compliance" },
];

export const materials = [
  { name: "Warm Travertine", use: "Living floor", qty: "412 sq ft", rate: 340, status: "Specified" },
  { name: "Brushed Oak", use: "Joinery", qty: "268 sq ft", rate: 520, status: "In review" },
  { name: "Lime Plaster", use: "Interior walls", qty: "1,920 sq ft", rate: 96, status: "Specified" },
  { name: "Blackened Steel", use: "Railings", qty: "64 rft", rate: 1250, status: "Quoted" },
  { name: "Fair-face Concrete", use: "Facade band", qty: "540 sq ft", rate: 410, status: "Specified" },
  { name: "Terracotta Screen", use: "West facade", qty: "180 sq ft", rate: 780, status: "Pending" },
];

export const costPackages = [
  { name: "Substructure", budget: 2100000, actual: 2040000 },
  { name: "Superstructure", budget: 5400000, actual: 5520000 },
  { name: "Envelope", budget: 3100000, actual: 2960000 },
  { name: "Interiors", budget: 4600000, actual: 4480000 },
  { name: "Services", budget: 2200000, actual: 2260000 },
  { name: "Landscape", budget: 1020000, actual: 940000 },
];

export const compliance = [
  { code: "BBMP 4.2.1", title: "Front setback ≥ 3.0m", status: "Pass", note: "3.4m provided" },
  { code: "BBMP 4.2.3", title: "North setback ≥ 1.5m", status: "Fail", note: "1.2m provided" },
  { code: "NBC 8.3", title: "Staircase width ≥ 1.0m", status: "Pass", note: "1.15m provided" },
  { code: "BBMP 6.1", title: "FAR ≤ 1.75", status: "Review", note: "1.74 — recheck after mezzanine" },
  { code: "NBC 5.4", title: "Habitable room ventilation ≥ 1/7 area", status: "Pass", note: "1/5.8 average" },
  { code: "ECBC 4.1", title: "Envelope U-value", status: "Pass", note: "0.38 W/m²K" },
];

export const vastu = [
  { zone: "North-East", element: "Water", verdict: "Aligned", note: "Pooja and light well placed correctly." },
  { zone: "South-East", element: "Fire", verdict: "Aligned", note: "Kitchen hob on the south-east corner." },
  { zone: "South-West", element: "Earth", verdict: "Review", note: "Master bedroom offset 1.1m from ideal." },
  { zone: "North-West", element: "Air", verdict: "Aligned", note: "Guest room and utility." },
];

export const members = [
  { name: "A. Rao", role: "Principal Architect", initials: "AR", status: "Editing Level 01" },
  { name: "S. Iyer", role: "Interior Lead", initials: "SI", status: "Interior Studio" },
  { name: "M. Khan", role: "Structural Engineer", initials: "MK", status: "Idle" },
  { name: "D. Pillai", role: "Contractor", initials: "DP", status: "Reviewing BOQ" },
  { name: "N. Varma", role: "Client", initials: "NV", status: "Viewing set B" },
];

export const threads = [
  {
    id: "C-114",
    on: "Level 01 · Living",
    author: "N. Varma",
    time: "2h",
    body: "Can the west window run full height? The evening light matters more than the wall.",
    replies: 3,
    state: "Open",
  },
  {
    id: "C-113",
    on: "Facade · West screen",
    author: "A. Rao",
    time: "5h",
    body: "Terracotta screen module set to 300mm. Waiting on vendor confirmation before we lock the BOQ.",
    replies: 1,
    state: "Blocked",
  },
  {
    id: "C-112",
    on: "Structural · S-04 rev C",
    author: "M. Khan",
    time: "1d",
    body: "Beam depth revised at grid C. Coordinate with the false ceiling level in the dining area.",
    replies: 5,
    state: "Resolved",
  },
];

export const revisions = [
  { id: "REV-07", label: "Level 01 layout — window study", by: "A. Rao", time: "Today 14:20", state: "Current" },
  { id: "REV-06", label: "Material palette — warm travertine", by: "S. Iyer", time: "Today 11:31", state: "Approved" },
  { id: "REV-05", label: "Structural set S-04 rev C", by: "M. Khan", time: "Yesterday", state: "Approved" },
  { id: "REV-04", label: "Cost model v2 — interiors", by: "D. Pillai", time: "2 days ago", state: "Superseded" },
];

export const documents = [
  { code: "A-101", title: "Ground floor plan", set: "Set B", rev: "C", date: "12 Aug", status: "Issued" },
  { code: "A-102", title: "Level 01 plan", set: "Set B", rev: "C", date: "12 Aug", status: "Issued" },
  { code: "A-201", title: "North & west elevations", set: "Set B", rev: "B", date: "09 Aug", status: "Issued" },
  { code: "A-301", title: "Section AA", set: "Set B", rev: "B", date: "09 Aug", status: "Draft" },
  { code: "S-04", title: "Framing plan", set: "Structural", rev: "C", date: "11 Aug", status: "Issued" },
  { code: "Q-01", title: "Bill of quantities", set: "Cost", rev: "D", date: "Today", status: "Draft" },
];

export const projects = [
  { id: "PRJ-2261", name: "Residence 01", type: "G+2 Residential", loc: "Bengaluru", progress: 0.62, state: "Design" },
  { id: "PRJ-2247", name: "Studio Kavya", type: "Workspace fit-out", loc: "Pune", progress: 0.88, state: "Documentation" },
  { id: "PRJ-2230", name: "Kadamba Retreat", type: "Hospitality", loc: "Coorg", progress: 0.34, state: "Concept" },
  { id: "PRJ-2214", name: "Halcyon Offices", type: "Commercial, 9 floors", loc: "Hyderabad", progress: 0.51, state: "Tender" },
  { id: "PRJ-2198", name: "Meridian Clinic", type: "Healthcare", loc: "Kochi", progress: 0.95, state: "On site" },
];

export const inr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
