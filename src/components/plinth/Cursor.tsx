import { useEffect, useRef, useState } from "react";

/** Precision cursor: a hairline crosshair dot that grows over interactive elements. */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [hot, setHot] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setEnabled(true);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let raf = 0;

    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const t = e.target as HTMLElement | null;
      setHot(!!t?.closest("a,button,[role=slider],[data-node]"));
    };

    const loop = () => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", move);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] hidden md:block">
      <div
        ref={ring}
        className={`absolute -ml-5 -mt-5 h-10 w-10 rounded-full border border-ink/40 transition-all duration-300 ${
          hot ? "scale-150 border-ink/70" : "scale-100"
        }`}
        style={{ mixBlendMode: "difference", borderColor: "rgba(255,255,255,0.6)" }}
      />
      <div
        className="absolute -ml-[2px] -mt-[2px] h-1 w-1 rounded-full bg-paper"
        ref={dot}
        style={{ mixBlendMode: "difference" }}
      />
    </div>
  );
}
