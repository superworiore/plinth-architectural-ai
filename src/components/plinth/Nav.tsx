import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/api";
import { FLOORS } from "./data";

export function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleOpenPlinth(e: React.MouseEvent) {
    e.preventDefault();
    if (getToken()) {
      window.location.href = "/app";
    } else {
      window.location.href = "/login";
    }
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div
        className={`pointer-events-auto mx-auto flex max-w-[1600px] items-center justify-between px-6 transition-all duration-700 md:px-10 ${
          solid ? "py-4" : "py-7"
        }`}
      >
        <a
          href="#top"
          className="group flex items-baseline gap-3 mix-blend-difference"
        >
          <span className="text-[15px] font-medium tracking-[0.4em] text-paper">
            PLINTH
          </span>
        </a>

        <nav
          className={`hidden items-center gap-1 rounded-full px-2 py-2 transition-all duration-700 lg:flex ${
            solid ? "glass" : "opacity-0"
          }`}
        >
          {FLOORS.map((f) => (
            <a
              key={f.id}
              href={`#${f.id}`}
              className="rounded-full px-4 py-1.5 text-[13px] text-graphite transition-colors duration-300 hover:bg-mist hover:text-ink"
            >
              {f.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenPlinth}
            className="hidden rounded-full border border-ink px-5 py-2.5 text-[13px] font-medium text-ink transition-all duration-500 hover:bg-ink hover:text-paper md:inline-flex"
            style={{ mixBlendMode: solid ? "normal" : "difference" }}
          >
            Open PLINTH
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="flex h-10 w-10 items-center justify-center rounded-full mix-blend-difference lg:hidden"
          >
            <span className="relative block h-3 w-5">
              <span
                className={`absolute left-0 h-px w-full bg-paper transition-all duration-500 ${
                  open ? "top-1.5 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 h-px w-full bg-paper transition-all duration-500 ${
                  open ? "top-1.5 -rotate-45" : "top-3"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        className={`pointer-events-auto overflow-hidden transition-all duration-700 lg:hidden ${
          open ? "max-h-[70vh]" : "max-h-0"
        }`}
      >
        <div className="glass mx-4 mb-4 rounded-3xl p-6">
          {FLOORS.map((f) => (
            <a
              key={f.id}
              href={`#${f.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-b border-border/60 py-3 text-[15px] text-ink last:border-0"
            >
              {f.label}
              <span className="label">{f.id}</span>
            </a>
          ))}
          <button
            onClick={handleOpenPlinth}
            className="mt-4 flex w-full justify-center rounded-full border border-ink py-2.5 text-[13px] font-medium text-ink"
          >
            Open PLINTH
          </button>
        </div>
      </div>
    </header>
  );
}

/** Floor indicator — the "elevator" rail. */
export function FloorRail() {
  const [active, setActive] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = FLOORS.map((f) => document.getElementById(f.id)).filter(
      Boolean,
    ) as HTMLElement[];
    if (!sections.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fixed right-8 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 transition-opacity duration-700 xl:flex ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      {FLOORS.map((f, i) => (
        <a
          key={f.id}
          href={`#${f.id}`}
          className="group flex items-center gap-3"
        >
          <span
            className={`text-[10px] tabular-nums tracking-[0.2em] transition-all duration-500 ${
              active === f.id
                ? "text-ink opacity-100"
                : "text-graphite opacity-0 group-hover:opacity-60"
            }`}
          >
            {String(i + 1).padStart(2, "0")} {f.label.toUpperCase()}
          </span>
          <span
            className={`h-px bg-ink transition-all duration-500 ${
              active === f.id ? "w-8 opacity-100" : "w-3 opacity-25"
            }`}
          />
        </a>
      ))}
    </div>
  );
}
