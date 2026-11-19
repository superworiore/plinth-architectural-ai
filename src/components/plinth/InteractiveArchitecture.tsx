import { useRef, useState } from "react";
import { Reveal } from "./Reveal";

const LEVELS = [
  { n: "L04", k: "Penthouse", v: "Double-height, private terrace, 4.2m slab-to-slab" },
  { n: "L03", k: "Residences", v: "6 units, cross-ventilated, north-lit" },
  { n: "L02", k: "Residences", v: "6 units, balcony line resolved to façade grid" },
  { n: "L01", k: "Amenity", v: "Lounge, work rooms, landscaped court" },
  { n: "L00", k: "Plinth", v: "Entrance, lobby, services, parking ramp" },
];

export function InteractiveArchitecture() {
  const [wipe, setWipe] = useState(52);
  const [level, setLevel] = useState(0);
  const dragging = useRef(false);

  const setFromPointer = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setWipe(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <section className="relative bg-paper py-[16vh]">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10">
        <Reveal className="flex items-baseline justify-between">
          <p className="label">07 — Interactive architecture</p>
          <p className="label hidden md:block">Floor 07</p>
        </Reveal>
        <div className="hairline-x mt-6" />

        <Reveal className="mt-[8vh] max-w-3xl">
          <h2 className="display text-[clamp(2rem,5vw,4rem)] text-ink">
            Drag between structure and finish.
          </h2>
        </Reveal>

        <div className="mt-[8vh] grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div
              onPointerDown={(e) => {
                dragging.current = true;
                setFromPointer(e.clientX, e.currentTarget);
              }}
              onPointerMove={(e) => {
                if (dragging.current) setFromPointer(e.clientX, e.currentTarget);
              }}
              onPointerUp={() => (dragging.current = false)}
              onPointerLeave={() => (dragging.current = false)}
              className="relative select-none overflow-hidden rounded-[28px] lift"
              role="slider"
              aria-label="Structure to finish comparison"
              aria-valuenow={Math.round(wipe)}
              aria-valuemin={0}
              aria-valuemax={100}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setWipe((v) => Math.max(0, v - 4));
                if (e.key === "ArrowRight") setWipe((v) => Math.min(100, v + 4));
              }}
            >
              <img
                src="/assets/final.jpg"
                alt="Completed building with glass facade"
                loading="lazy"
                className="h-[58vh] w-full object-cover"
              />
              <img
                src="/assets/frame.jpg"
                alt="Structural frame of the same building"
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover grayscale"
                style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)` }}
              />
              <span
                className="absolute inset-y-0 w-px bg-paper"
                style={{ left: `${wipe}%` }}
              />
              <span
                className="glass absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] tracking-widest text-ink"
                style={{ left: `${wipe}%` }}
              >
                ↔
              </span>
              <span className="glass absolute bottom-5 left-5 rounded-xl px-4 py-2 text-[12px] font-medium text-ink">
                Structure
              </span>
              <span className="glass absolute bottom-5 right-5 rounded-xl px-4 py-2 text-[12px] font-medium text-ink">
                Finish
              </span>
            </div>
          </div>

          <div className="lg:col-span-4">
            <p className="label">Section — levels</p>
            <ul className="mt-5">
              {LEVELS.map((l, i) => (
                <li key={l.n}>
                  <button
                    onMouseEnter={() => setLevel(i)}
                    onFocus={() => setLevel(i)}
                    className="w-full border-b border-border py-4 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-[11px] tabular-nums tracking-[0.2em] transition-colors duration-400 ${
                          level === i ? "text-ink" : "text-graphite"
                        }`}
                      >
                        {l.n}
                      </span>
                      <span
                        className={`h-px flex-1 transition-all duration-500 ${
                          level === i ? "bg-ink" : "bg-border"
                        }`}
                      />
                      <span
                        className={`text-[15px] font-medium tracking-tight transition-colors duration-400 ${
                          level === i ? "text-ink" : "text-graphite"
                        }`}
                      >
                        {l.k}
                      </span>
                    </div>
                    <div
                      className={`grid transition-all duration-600 ${
                        level === i
                          ? "mt-2 grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <p className="overflow-hidden text-[13px] leading-relaxed text-graphite">
                        {l.v}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
