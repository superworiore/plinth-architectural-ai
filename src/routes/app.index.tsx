import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FloorPlan, type RoomData } from "@/components/plinth/dashboard/floor-plan";
import { Bar, Metric, Panel, Status } from "@/components/plinth/dashboard/ui";
import { useProjects, useFloors, useCosts, useCompliance, useActivity } from "@/hooks/use-api";
import { Room } from "@/lib/api";
import { sqmToSqft, estimateRoomAreaSqm } from "@/lib/geometry-utils";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Overview — PLINTH" },
      { name: "description", content: "Project overview: progress, cost, materials, compliance and recent studio activity." },
      { property: "og:title", content: "Overview — PLINTH" },
      { property: "og:description", content: "Live project state across design, cost, materials and compliance." },
    ],
  }),
  component: Overview,
});

const inr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

function Overview() {
  const { data: projectsData } = useProjects();
  const currentProject = projectsData?.projects?.[0];
  const projectId = currentProject?.id ?? "";

  const { data: costsData } = useCosts(projectId);
  const { data: complianceData } = useCompliance(projectId);
  const { data: activityData } = useActivity(projectId);
  const { data: floorsData } = useFloors(projectId);

  const floors = floorsData?.floors ?? [];
  const activeFloor = floors.find((f) => f.level_number === 0) ?? floors[0];
  const activeRooms = useMemo(() => {
    if (!activeFloor?.rooms?.length) return undefined;
    return activeFloor.rooms.map((r: Room, i: number): RoomData => {
      const geom = (r.geometry as Record<string, unknown> | null | undefined) ?? {};
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = typeof geom["x"] === "number" ? (geom["x"] as number) : 4 + col * 22;
      const y = typeof geom["y"] === "number" ? (geom["y"] as number) : 4 + row * 15;
      const w = typeof geom["w"] === "number" ? (geom["w"] as number) : 18;
      const h = typeof geom["h"] === "number" ? (geom["h"] as number) : 13;
      const orientation = typeof geom["orientation"] === "string" ? (geom["orientation"] as string) : "NE";
      const area_sqm = r.area_sqm != null ? r.area_sqm : estimateRoomAreaSqm(w, h).areaSqm;
      const area = sqmToSqft(area_sqm);
      return { id: r.id, name: r.name, type: r.type, area, area_sqm, x, y, w, h, orientation };
    });
  }, [activeFloor]);

  const budget = currentProject?.budget ? Number(currentProject.budget) : 15000000;
  const spent = currentProject?.spent ? Number(currentProject.spent) : (costsData?.summary?.total_spent ?? 4300000);
  const estimatedCost = costsData?.summary?.total_estimated ?? 16081416;
  const variancePercent = costsData?.summary?.variance_percent ?? -3.2;

  const failingCount = complianceData?.failing ?? 0;
  const reviewCount = complianceData?.in_review ?? 0;
  const openComplianceCount = failingCount + reviewCount;

  const activityList = (activityData?.activities && activityData.activities.length > 0)
    ? activityData.activities
    : [
        { id: "1", created_at: new Date().toISOString(), action: "Revised Level 01 wall thickness to 230mm", user_name: "A. Rao", user_role: "Architect" },
        { id: "2", created_at: new Date(Date.now() - 3600000).toISOString(), action: "Cost variance detected in joinery package (−3.2%)", user_name: "PLINTH", user_role: "Intelligence" },
        { id: "3", created_at: new Date(Date.now() - 7200000).toISOString(), action: "Approved material palette — Warm Travertine", user_name: "S. Iyer", user_role: "Interior" },
        { id: "4", created_at: new Date(Date.now() - 14400000).toISOString(), action: "Uploaded structural set S-04 rev C", user_name: "M. Khan", user_role: "Engineer" },
        { id: "5", created_at: new Date(Date.now() - 86400000).toISOString(), action: "Automated NBC setback audit completed — 1 item open", user_name: "PLINTH", user_role: "Compliance" },
      ];

  const recommendations = [
    { title: "Optimize superstructure grid", detail: "Structural cost estimate at 29% total budget — grid rationalization saves ~₹180,000.", tag: "Cost" },
    { title: "Resolve fire staircase width", detail: "Width 1.0m is below NBC requirement 1.2m.", tag: "Compliance" },
    { title: "Orient main living area South-East", detail: "Enhances natural lighting and passive ventilation efficiency.", tag: "Layout" },
  ];

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-5">
        <div>
          <span className="label-tech">
            {currentProject?.code ?? "PLT-2026-001"} · {currentProject?.typology?.replace("_", " ").toUpperCase() ?? "RESIDENTIAL"}
          </span>
          <h1 className="mt-2 text-2xl font-light tracking-[-0.015em]">
            {currentProject?.name ?? "Residence 01 — Shah Villa"}
          </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {currentProject?.location ?? "Koramangala, Bangalore"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Status tone="warn">{currentProject?.status?.replace("_", " ").toUpperCase() ?? "DESIGN"}</Status>
              <Link
                to="/app/floor-planner"
                className="inline-flex h-8 items-center border border-foreground bg-foreground px-3.5 text-[12px] text-background transition-colors hover:bg-transparent hover:text-foreground"
              >
                Open plan
              </Link>
            </div>
          </div>

          <div className="grid gap-px border-b border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-card">
              <Metric
                label="Progress"
                value={`${Math.round((currentProject?.progress ?? 0.42) * 100)}%`}
                sub="Level 01 — Design"
              />
              <div className="px-4 pb-4">
                <Bar value={currentProject?.progress ?? 0.42} />
              </div>
            </div>
            <div className="bg-card">
              <Metric
                label="Estimated cost"
                value={inr(estimatedCost)}
                sub={`${inr(spent)} committed`}
              />
              <div className="px-4 pb-4">
                <Bar value={budget > 0 ? Math.min(spent / budget, 1) : 0.3} tone="steel" />
              </div>
            </div>
            <div className="bg-card">
              <Metric
                label="Cost variance"
                value={`${variancePercent > 0 ? "+" : ""}${variancePercent.toFixed(1)}%`}
                sub={variancePercent <= 0 ? "Under budget" : "Over budget"}
                accent={variancePercent > 0}
              />
              <div className="px-4 pb-4">
                <Bar value={Math.min(Math.abs(variancePercent) / 10, 1)} tone="oxide" />
              </div>
            </div>
            <div className="bg-card">
              <Metric
                label="Compliance"
                value={`${openComplianceCount} open`}
                sub={`${failingCount} failing · ${reviewCount} in review`}
              />
              <div className="px-4 pb-4">
                <Bar value={0.71} tone="moss" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 xl:grid-cols-[1.6fr_1fr]">
            <Panel title={activeFloor ? `Level ${String(activeFloor.level_number).padStart(2, "0")} — ${activeFloor.name}` : "Level 00 — Ground Floor"} meta="Plan · live" bodyClassName="p-0" actions={<span className="label-tech">1:100</span>}>
              <div className="h-[420px] bg-background">
                <FloorPlan roomList={activeRooms} />
              </div>
            </Panel>

            <div className="grid gap-4">
              <Panel title="Status" bodyClassName="p-0">
                <ul className="divide-y divide-border">
                  <li className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px]">Design</span>
                      <span className="font-mono text-[11px] text-muted-foreground">Schematic — {Math.round((currentProject?.progress ?? 0.42) * 100)}%</span>
                    </div>
                    <div className="mt-2.5">
                      <Bar value={currentProject?.progress ?? 0.42} tone="ink" />
                    </div>
                  </li>
                  <li className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px]">Compliance</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{openComplianceCount} open items</span>
                    </div>
                    <div className="mt-2.5">
                      <Bar value={0.71} tone={openComplianceCount > 0 ? "oxide" : "moss"} />
                    </div>
                  </li>
                  <li className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px]">Costs</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{costsData?.items?.length ?? 6} items estimated</span>
                    </div>
                    <div className="mt-2.5">
                      <Bar value={0.8} tone="moss" />
                    </div>
                  </li>
                </ul>
              </Panel>

              <Panel title="Recommendations" meta="PLINTH intelligence" bodyClassName="p-0">
                <ul className="divide-y divide-border">
                  {recommendations.map((r) => (
                    <li key={r.title} className="group px-4 py-3.5 transition-colors hover:bg-secondary">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13px] leading-snug">{r.title}</p>
                        <span className="label-tech shrink-0">{r.tag}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{r.detail}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>

          <div className="grid gap-4 px-4 xl:grid-cols-[1fr_1fr]">
            <Panel title="Activity" meta="Live project log" bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {activityList.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex gap-4 px-4 py-3">
                    <span className="label-tech w-20 shrink-0 pt-0.5">
                      {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px]">{a.action}</p>
                      <p className="label-tech mt-1">
                        {a.user_name ?? "User"} · {a.user_role?.replace("_", " ") ??