import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Status } from "@/components/plinth/dashboard/ui";
import { vastu } from "@/lib/plinth-data";
import { useProjects } from "@/hooks/use-api";

export const Route = createFileRoute("/app/site-analysis")({
  head: () => ({
    meta: [
      { title: "Site Analysis — PLINTH" },
      { name: "description", content: "Plot envelope, sun path, wind, access and Vastu evaluation for the project site." },
    ],
  }),
  component: SiteAnalysis,
});

function SiteAnalysis() {
  const { data: projectsData } = useProjects();
  const currentProject = projectsData?.projects?.[0];
  const plotData = (currentProject?.plot_data ?? {}) as Record<string, unknown>;

  // Extract values from real plot data, falling back to placeholder text
  const plotArea = plotData["area"] ? `${plotData["area"]} sq m` : "—";
  const permissibleFar = plotData["max_far"] ? String(plotData["max_far"]) : "—";
  const proposedFar = plotData["proposed_far"] ? String(plotData["proposed_far"]) : "—";
  const maxCoverage = plotData["max_coverage_pct"] ? `${plotData["max_coverage_pct"]}%` : "—";
  const proposedCoverage = plotData["proposed_coverage_pct"]
    ? `${plotData["proposed_coverage_pct"]}%${plotData["max_coverage_pct"] ? ` of ${plotData["max_coverage_pct"]}%` : ""}`
    : "—";
  const heightLimit = plotData["max_height_m"] ? `${plotData["max_height_m"]} m` : "—";
  const proposedHeight = plotData["proposed_height_m"] ? `${plotData["proposed_height_m"]} m` : "—";
  const plotWidth = plotData["width"] ? String(plotData["width"]) : "—";
  const plotLength = plotData["length"] ? String(plotData["length"]) : "—";

  const hasPlotData = Object.keys(plotData).length > 0;

  return (
    <div className="pb-8">
      <PageHeader
        index="05 — Site analysis"
        title={currentProject?.location ?? "Plot location not set"}
        desc={
          hasPlotData
            ? `${plotWidth} × ${plotLength} m plot. Permissible envelope derived from project data.`
            : "No plot data available yet. Complete Plot Analysis to populate this view."
        }
      />

      <div className="grid gap-4 p-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Site plan" meta="1:200 · sun path 21 Jun" bodyClassName="p-0">
          <div className="grid-paper aspect-[4/3] w-full">
            <svg viewBox="0 0 800 600" className="h-full w-full">
              <rect x="120" y="90" width="520" height="420" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <rect x="180" y="140" width="400" height="320" fill="color-mix(in oklab, var(--oxide) 7%, transparent)" stroke="currentColor" strokeDasharray="6 5" strokeWidth="1" className="text-accent" />
              <rect x="210" y="175" width="340" height="250" fill="color-mix(in oklab, var(--foreground) 8%, transparent)" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <text x="380" y="305" textAnchor="middle" className="fill-foreground font-mono" fontSize="12" letterSpacing="2">
                {hasPlotData ? `FOOTPRINT ${plotArea}` : "NO PLOT DATA"}
              </text>
              <path d="M90 470 Q 380 60 670 470" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 6" className="text-muted-foreground" />
              <circle cx="600" cy="200" r="6" className="fill-accent" />
              <text x="612" y="196" className="fill-muted-foreground font-mono" fontSize="10">17:40</text>
              <path d="M700 520 L640 470" stroke="currentColor" strokeWidth="1" className="text-steel" />
              <text x="646" y="540" className="fill-muted-foreground font-mono" fontSize="10">PREVAILING SW</text>
              <rect x="60" y="90" width="40" height="420" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" className="text-muted-foreground" />
              <text x="80" y="300" textAnchor="middle" transform="rotate(-90 80 300)" className="fill-muted-foreground font-mono" fontSize="10">
                9 M ROAD
              </text>
              <g transform="translate(700,120)" className="text-foreground">
                <path d="M0 -16 L6 8 L0 2 L-6 8 Z" fill="currentColor" />
                <text y="26" textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="10">N</text>
              </g>
            </svg>
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel title="Envelope" bodyClassName="p-0">
            <dl className="divide-y divide-border">
              {[
                ["Plot area", plotArea],
                ["Plot dimensions", hasPlotData ? `${plotWidth} × ${plotLength} m` : "—"],
                ["Permissible FAR", permissibleFar],
                ["Proposed FAR", proposedFar],
                ["Max coverage", maxCoverage],
                ["Proposed coverage", proposedCoverage],
                ["Height limit", heightLimit],
                ["Proposed height", proposedHeight],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between px-4 py-2.5">
                  <dt className="label-tech">{k}</dt>
                  <dd className="font-mono text-[11px]">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Climate">
            <ul className="space-y-3 text-[13px] text-muted-foreground">
              <li>Peak west radiation 17:10–18:20 — screen recommended.</li>
              <li>Cross ventilation achievable in 5 of 6 habitable rooms.</li>
              <li>Monsoon runoff directed to the south-east percolation pit.</li>
            </ul>
          </Panel>

          <Panel title="Vastu" meta="Advisory" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {vastu.map((v) => (
                <li key={v.zone} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px]">
                      {v.zone} <span className="label-tech">· {v.element}</span>
                    </span>
                    <Status tone={v.verdict === "Aligned" ? "ok" : "warn"}>{v.verdict}</Status>
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted-foreground">{v.note}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
