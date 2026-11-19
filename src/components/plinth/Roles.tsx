import { useMemo, useState } from "react";
import { useGsapScope } from "@/lib/anim";
import { Reveal } from "./Reveal";
import { ROLES } from "./data";

// Radial layout — the role graph as an architectural plan.
const R = 38;
const POS = ROLES.map((r, i) => {
  const a = (i / ROLES.length) * Math.PI * 2 - Math.PI / 2;
  return { id: r.id, x: 50 + Math.cos(a) * R, y: 50 + Math.sin(a) * R * 0.82 };
});

export function Roles() {
  const [active, setActive] = useState<string | null>(null);
  const posById = useMemo(
    () => Object.fromEntries(POS.map((p) => [p.id, p])),
    [],
  );

  const scope = useGsapScope<HTMLElement>(({ gsap, root }) => {
    gsap.fromTo(
      "[data-edge]",
      { strokeDasharray: 200, strokeDashoffset: 200 },
      {
        strokeDashoffset: 0,
        duration: 1.6,
        stagger: 0.05,
        ease: "power2.out",
        scrollTrigger: { trigger: root, start: "top 65%" },
      },
    );
    gsap.fromTo(
      "[data-node]",
      { opacity: 0, scale: 0.85, filter: "blur(8px)" },
      {
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        duration: 1,
        stagger: 0.06,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 70%" },
      },
    );
  }, []);

  const edges = ROLES.flatMap((r) =>
    r.links.map((l) => ({ from: r.id, to: l, key: `${r.id}-${l}` })),
  );

  return (
    <section id="roles" ref={scope} className="relative bg-paper py-[16vh]">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10">
        <Reveal className="flex items-baseline justify-between">
          <p className="label">03 — Together</p>
          <p className="label hidden md:block">Floor 03</p>
        </Reveal>
        <div className="hairline-x mt-6" />

        <Reveal className="mt-[8vh] max-w-2xl">
          <h2 className="display text-[clamp(2rem,5vw,4.25rem)] text-ink">
            Everyone who touches the building, in the same room.
          </h2>
          <p className="mt-7 text-[16px] leading-relaxed text-graphite">
            Hover a discipline to see where its decisions travel. Nothing is
            emailed, nothing is redrawn.
          </p>
        </Reveal>


        <div className="mt-[8vh] grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="relative lg:col-span-7">
            <div className="relative aspect-square w-full">
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <circle
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke="var(--hairline)"
                  strokeWidth="0.15"
                />
                {edges.map((e) => {
                  const a = posById[e.from];
                  const b = posById[e.to];
                  if (!a || !b) return null;
                  const on = active === e.from || active === e.to;
                  return (
                    <line
                      key={e.key}
                      data-edge
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="var(--ink)"
                      strokeWidth={on ? 0.4 : 0.12}
                      opacity={active ? (on ? 0.9 : 0.06) : 0.18}
                      className="transition-all duration-500"
                    />
                  );
                })}
              </svg>

              {POS.map((p, i) => {
                const role = ROLES[i]!;
                const on = active === role.id;
                const dim =
                  !!active && !on && !ROLES.find((r) => r.id === active)?.links.includes(role.id as never);
                return (
                  <button
                    key={p.id}
                    data-node
                    onMouseEnter={() => setActive(role.id)}
                    onFocus={() => setActive(role.id)}
                    onMouseLeave={() => setActive(null)}
                    onBlur={() => setActive(null)}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-[12px] font-medium tracking-tight transition-all duration-500 md:text-[13px] ${
                      on
                        ? "bg-ink text-paper lift scale-110"
                        : "glass text-ink hover:scale-105"
                    } ${dim ? "opacity-30" : "opacity-100"}`}
                  >
                    {role.name}
                  </button>
                );
              })}

              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="label">Project graph</p>
                <p className="mt-1 text-[15px] font-medium tracking-[0.3em] text-ink">
                  PLINTH
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <ul className="divide-y divide-border">
              {ROLES.map((r) => {
                const on = active === r.id;
                return (
                  <li key={r.id}>
                    <button
                      onMouseEnter={() => setActive(r.id)}
                      onMouseLeave={() => setActive(null)}
                      className="group w-full py-5 text-left"
                    >
                      <div className="flex items-center justify-between gap-6">
                        <span
                          className={`text-[18px] font-medium tracking-tight transition-colors duration-400 md:text-[20px] ${
                            on ? "text-ink" : "text-graphite"
                          }`}
                        >
                          {r.name}
                        </span>
                        <span
                          className={`h-px transition-all duration-500 ${
                            on ? "w-10 bg-brass" : "w-4 bg-border"
                          }`}
                        />

                      </div>
                      <div
                        className={`grid transition-all duration-600 ${
                          on
                            ? "mt-2 grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <p className="overflow-hidden text-[14px] leading-relaxed text-graphite">
                          {r.line}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
