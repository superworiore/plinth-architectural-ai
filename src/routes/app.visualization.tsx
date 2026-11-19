import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import exterior from "@/assets/exterior-render.jpg";
import living from "@/assets/interior-living.jpg";
import dining from "@/assets/interior-dining.jpg";
import bedroom from "@/assets/interior-bedroom.jpg";
import { PageHeader, Panel, Status, ToolButton } from "@/components/plinth/dashboard/ui";

export const Route = createFileRoute("/app/visualization")({
  head: () => ({
    meta: [
      { title: "Visualization — PLINTH" },
      { name: "description", content: "Model-accurate renders, walkthrough frames and 3D views generated from the project model." },
    ],
  }),
  component: Visualization,
});

const shots = [
  { img: exterior, name: "West facade — 17:40", res: "4096 × 2560", state: "Final" },
  { img: living, name: "Living — daylight", res: "3200 × 2000", state: "Final" },
  { img: dining, name: "Dining — morning", res: "2400 × 1800", state: "Draft" },
  { img: bedroom, name: "Bedroom 01 — soft", res: "2400 × 1800", state: "Draft" },
];

function Visualization() {
  const [main, setMain] = useState(0);
  const current = shots[main]!;

  return (
    <div className="pb-8">
      <PageHeader
        index="04 — Visualization"
        title="Renders & 3D views"
        desc="Every frame is generated from the current model state. Materials, openings and levels stay in sync with the drawing set."
        actions={<ToolButton>Render queue · 2</ToolButton>}
      />

      <div className="grid gap-4 p-4 xl:grid-cols-[2fr_1fr]">
        <Panel title={current.name} meta={current.res} bodyClassName="p-0">
          <img
            src={current.img}
            alt={current.name}
            width={1600}
            height={1000}
            loading="lazy"
            className="aspect-[16/10] w-full object-cover"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
            <ToolButton active>Camera 01</ToolButton>
            <ToolButton>Camera 02</ToolButton>
            <ToolButton>Section view</ToolButton>
            <ToolButton>Massing</ToolButton>
            <span className="label-tech ml-auto">Ray depth 12 · 34 min</span>
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel title="Frames" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {shots.map((s, i) => (
                <li key={s.name}>
                  <button
                    onClick={() => setMain(i)}
                    className={`flex w-full items-center gap-3 p-3 text-left transition-colors ${i === main ? "bg-secondary" : "hover:bg-secondary/60"}`}
                  >
                    <img src={s.img} alt="" width={96} height={64} loading="lazy" className="h-12 w-16 border border-border object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">{s.name}</span>
                      <span className="label-tech">{s.res}</span>
                    </span>
                    <span className="ml-auto">
                      <Status tone={s.state === "Final" ? "ok" : "neutral"}>{s.state}</Status>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Scene">
            <dl className="divide-y divide-border">
              {[
                ["Time of day", "17:40"],
                ["Sky", "Clear, 12% haze"],
                ["Exposure", "EV 11.2"],
                ["Lens", "24 mm · f/8"],
                ["Materials", "31 linked"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between py-2.5">
                  <dt className="label-tech">{k}</dt>
                  <dd className="font-mono text-[11px]">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
