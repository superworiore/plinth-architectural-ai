import { useEffect, useState } from "react";

export function Loader() {
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    let p = 0;
    const id = window.setInterval(() => {
      p = Math.min(100, p + (100 - p) * 0.28 + 4.5);
      setPct(p);
      if (p > 99.2) {
        window.clearInterval(id);
        setPct(100);
        window.setTimeout(() => setDone(true), 80);
      }
    }, 20);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => {
      document.body.style.overflow = "";
      setGone(true);
      window.dispatchEvent(new Event("plinth:ready"));
    }, 300);
    return () => window.clearTimeout(t);
  }, [done]);

  if (gone) return null;

  return (
    <div
      aria-hidden={done}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-paper transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        opacity: done ? 0 : 1,
        transform: done ? "scale(1.04)" : "scale(1)",
        pointerEvents: done ? "none" : "auto",
      }}
    >
      <svg
        viewBox="0 0 200 120"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
        aria-hidden="true"
      >
        <g stroke="var(--ink)" strokeWidth="0.2" fill="none">
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 16.6} y1="0" x2={i * 16.6} y2="120" />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 17.2} x2="200" y2={i * 17.2} />
          ))}
        </g>
      </svg>

      <p className="label mb-8">Architecture, computed</p>

      <h1 className="display flex gap-[0.06em] text-[clamp(2.6rem,9vw,7rem)] text-ink">
        {"PLINTH".split("").map((c, i) => (
          <span key={i} className="overflow-hidden pb-[0.08em]">
            <span
              className="block"
              style={{
                animation: `plinth-rise 0.45s cubic-bezier(0.16,1,0.3,1) ${i * 0.035}s both`,
              }}
            >
              {c}
            </span>
          </span>
        ))}
      </h1>

      <div className="mt-12 flex w-[min(78vw,420px)] items-center gap-4">
        <div className="relative h-px flex-1 bg-hairline">
          <div
            className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 text-right text-[11px] tabular-nums tracking-[0.18em] text-graphite">
          {String(Math.round(pct)).padStart(3, "0")}
        </span>
      </div>

      <p className="label mt-6 !tracking-[0.3em]">
        {pct < 45 ? "Setting grid" : pct < 80 ? "Loading structure" : "Entering"}
      </p>

      <style>{`@keyframes plinth-rise{from{transform:translateY(110%);opacity:0;filter:blur(12px)}to{transform:translateY(0);opacity:1;filter:blur(0)}}`}</style>
    </div>
  );
}
