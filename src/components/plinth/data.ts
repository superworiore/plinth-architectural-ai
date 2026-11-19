export const ROLES = [
  {
    id: "super-admin",
    name: "Super Admin",
    line: "Governs the platform: tenants, permissions, standards libraries and audit.",
    links: ["project-admin", "client"],
  },
  {
    id: "project-admin",
    name: "Project Admin",
    line: "Owns the project graph — scope, stages, approvals and issue records.",
    links: ["architect", "builder", "client"],
  },
  {
    id: "client",
    name: "Client",
    line: "Sets intent and budget, and sees every consequence in real time.",
    links: ["architect", "interior", "project-admin"],
  },
  {
    id: "architect",
    name: "Architect",
    line: "Shapes massing, floor plates, cores and the design narrative.",
    links: ["interior", "structural", "client"],
  },
  {
    id: "interior",
    name: "Interior Designer",
    line: "Resolves material, light and workplace systems floor by floor.",
    links: ["vendor", "client"],
  },
  {
    id: "builder",
    name: "Builder / Contractor",
    line: "Converts drawings into sequenced, costed, buildable work.",
    links: ["site", "vendor", "structural"],
  },
  {
    id: "structural",
    name: "Structural Engineer",
    line: "Validates load paths, long spans, cores and code compliance.",
    links: ["site", "builder"],
  },
  {
    id: "site",
    name: "Site Engineer",
    line: "Reports built reality back into the model, daily.",
    links: ["builder", "vendor"],
  },
  {
    id: "vendor",
    name: "Vendor / Supplier",
    line: "Supplies materials and systems against live quantities.",
    links: ["builder", "interior"],
  },
] as const;

export type Role = (typeof ROLES)[number];

/** Capability chapters — narrative, not a feature checklist. */
export const CHAPTERS = [
  {
    index: "I",
    title: "Read the ground",
    line: "A single coordinate becomes site intelligence: setbacks, buildable envelope, solar path, terrain, FAR.",
    notes: ["Plot analysis", "Solar & terrain", "Buildable envelope"],
  },
  {
    index: "II",
    title: "Draw the building",
    line: "A written brief resolves into circulation-correct floor plates, then extrudes into massing, core and facade.",
    notes: ["Floor plans", "Massing", "Facade systems"],
  },
  {
    index: "III",
    title: "Dress the floors",
    line: "Material, light and workplace direction, floor by floor, with clearance and anthropometrics respected.",
    notes: ["Interior AI", "Materials", "Furniture fit"],
  },
  {
    index: "IV",
    title: "Prove it stands",
    line: "Grids, spans and members validated against load, with byelaws, fire and accessibility checked continuously.",
    notes: ["Structure", "Compliance", "Fire & access"],
  },
  {
    index: "V",
    title: "Price and issue",
    line: "Quantities derived from geometry rather than retyped, a cost surface that moves with the model, drawings issued on demand.",
    notes: ["Quantities", "Live cost", "Drawing sets"],
  },
] as const;

export const MODULES = [
  { n: "01", k: "AI Plot Analysis", v: "Coordinates to buildable envelope, setbacks, solar and terrain." },
  { n: "02", k: "AI Floor Plan", v: "Brief to circulation-correct floor plates and core placement." },
  { n: "03", k: "3D Building Generation", v: "Plates extruded into massing, facade and envelope systems." },
  { n: "04", k: "Interior AI", v: "Material, light and workplace direction, floor by floor." },
  { n: "05", k: "Furniture Intelligence", v: "Layouts that respect clearance, density and anthropometrics." },
  { n: "06", k: "Material Intelligence", v: "Specification with performance, lead time and cost attached." },
  { n: "07", k: "Cost Estimation", v: "A live cost surface that moves with the model, not the spreadsheet." },
  { n: "08", k: "BOQ", v: "Quantities derived from geometry — never retyped." },
  { n: "09", k: "Compliance", v: "Byelaws, fire and accessibility checked continuously by rule graph." },
  { n: "10", k: "Structural Analysis", v: "Grids, spans and members validated against real load paths." },
  { n: "11", k: "Project Management", v: "Stages, approvals, sequencing and issue records in one graph." },
  { n: "12", k: "Documents", v: "Versioned drawing sets, schedules and lineage on demand." },
  { n: "13", k: "AI Assistant", v: "Ask the building anything — it answers from the model." },
] as const;

export const PROBLEMS = [
  { k: "Fragmented tools", v: "Twelve applications, none of which agree with each other." },
  { k: "Redrawn work", v: "The same building modelled four times by four disciplines." },
  { k: "Late cost", v: "Budget truth arrives after the design is frozen." },
  { k: "Blind compliance", v: "Code checked at submission instead of while drawing." },
] as const;

export const SOLUTIONS = [
  { k: "One continuous model", v: "Every discipline works inside the same geometry." },
  { k: "Derived, not retyped", v: "Quantities, cost and drawings fall out of the model." },
  { k: "Live consequence", v: "Change a plate; see cost, load and code respond." },
  { k: "Issued from source", v: "Drawing sets generated from the file that is actually true." },
] as const;

export const TECH = [
  { k: "Geometry core", v: "Parametric solver, IFC-native" },
  { k: "Models", v: "Multi-model routing, spatial reasoning" },
  { k: "Rendering", v: "Progressive WebGL, streamed LODs" },
  { k: "Compliance", v: "Rule graph, jurisdiction-aware" },
  { k: "Data", v: "Versioned project graph, full lineage" },
  { k: "Delivery", v: "Edge-rendered, sub-second interaction" },
] as const;

export const FLOORS = [
  { id: "vision", label: "Vision" },
  { id: "story", label: "Problem" },
  { id: "platform", label: "Platform" },
  { id: "roles", label: "Together" },
  { id: "modules", label: "Capability" },
  { id: "index", label: "Modules" },
  { id: "ai", label: "Intelligence" },
  { id: "spatial", label: "Spatial" },
  { id: "technology", label: "Craft" },
  { id: "future", label: "Future" },
] as const;
