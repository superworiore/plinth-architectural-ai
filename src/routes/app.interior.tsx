import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import living from "@/assets/interior-living.jpg";
import dining from "@/assets/interior-dining.jpg";
import bedroom from "@/assets/interior-bedroom.jpg";
import { Panel, ToolButton } from "@/components/plinth/dashboard/ui";

export const Route = createFileRoute("/app/interior")({
  head: () => ({
    meta: [
      { title: "Interior Studio — PLINTH" },
      { name: "description", content: "A visual interior workspace: materials, furniture, lighting and design variations on the live model." },
    ],
  }),
  component: Interior,
});

const variations = [
  { id: "V1", label: "Warm travertine", img: living },
  { id: "V2", label: "Lime & oak", img: dining },
  { id: "V3", label: "Soft plaster", img: bedroom },
];

const palette = [
  { name: "Warm travertine", swatch: "oklch(0.86 0.03 75)", use: "Floor" },
  { name: "Fair-face concrete", swatch: "oklch(0.72 0.008 80)", use: "Feature wall" },
  { name: "Brushed oak", swatch: "oklch(0.68 0.06 65)", use: "Joinery" },
  { name: "Lime plaster", swatch: "oklch(0.92 0.012 88)", use: "Walls" },
  { name: "Blackened steel", swatch: "oklch(0.32 0.006 70)", use: "Details" },
  { name: "Natural linen", swatch: "oklch(0.83 0.02 85)", use: "Upholstery" },
];

const furniture = [
  { name: "Low linen sofa", spec: "2 400 × 900", price: "₹186,000" },
  { name: "Oak plank table", spec: "2 200 × 950", price: "₹142,000" },
  { name: "Leather sling chair", spec: "700 × 780", price: "₹64,000" },
  { name: "Stone side table", spec: "Ø 420", price: "₹28,000" },
];

function Interior() {
  const [active, setActive] = useState(0);
  const [warmth, setWarmth] = useState(62);
  const [intensity, setIntensity] = useState(48);

  const current = variations[active]!;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col xl:flex-row">
      {/* canvas */}
      <div className="relative min-h-[52vh] flex-1 border-b border-border bg-secondary xl:border-b-0">
        <img
          src={current.img}
          alt={`Interior variation ${current.label}`}
          width={1600}
          height={1000}
          loading="lazy"
          className="h-full w-full object-cover"
          style={{
            filter: `saturate(${0.7 + warmth / 180}) brightness(${0.82 + intensity / 260})`,
          }}
        />
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="border border-foreground/20 bg-background/85 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase">
            Level 01 · Living
          </span>
          <span className="border border-foreground/20 bg-background/85 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase">
            {current.label}
          </span>
        </div>
        <div className="absolute right-4 bottom-4 left-4 flex flex-wrap items-center gap-2">
          {variations.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setActive(i)}
              className={`h-14 w-20 overflow-hidden border transition-all ${
                i === active ? "border-accent" : "border-foreground/20 opacity-70 hover:opacity-100"
              }`}
            >
              <img src={v.img} alt={v.label} width={160} height={112} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
          <ToolButton>Generate variation</ToolButton>
        </div>
      </div>

      {/* controls */}
      <aside className="w-full shrink-0 space-y-4 bg-sidebar p-4 xl:w-96 xl:overflow-y-auto">
        <Panel title="Material palette" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {palette.map((m) => (
              <li key={m.name} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary">
                <span className="h-6 w-6 border border-border" style={{ background: m.swatch }} />
                <span className="text-[13px]">{m.name}</span>
                <span className="label-tech ml-auto">{m.use}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Lighting">
          <div className="space-y-5">
            {[
              ["Warmth", warmth, setWarmth, "2700K — 4000K"],
              ["Intensity", intensity, setIntensity, "Evening scene"],
            ].map(([label, value, set, note]) => (
              <div key={label as string}>
                <div className="flex items-baseline justify-between">
                  <span className="label-tech">{label as string}</span>
                  <span className="font-mono text-[11px]">{value as number}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value as number}
                  onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
                  className="mt-2 h-1 w-full appearance-none bg-concrete accent-accent"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">{note as string}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Furniture" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {furniture.map((f) => (
              <li key={f.name} className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="text-[13px]">{f.name}</span>
                <span className="label-tech ml-auto">{f.spec}</span>
                <span className="font-mono text-[11px]">{f.price}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Suggestions" meta="Contextual">
          <ul className="space-y-3 text-[13px]">
            {[
              "Warmer travertine raises perceived cost by 4% — offset with lime plaster on the return wall.",
              "West glare peaks at 17:40. A 300mm terracotta screen reduces it by 38%.",
              "Swap the sling chair for a local oak equivalent: saves ₹22,000, keeps the palette.",
            ].map((s) => (
              <li key={s} className="border-l-2 border-accent/50 pl-3 leading-relaxed text-muted-foreground">
                {s}
              </li>
            ))}
          </ul>
        </Panel>
      </aside>
    </div>
  );
}
