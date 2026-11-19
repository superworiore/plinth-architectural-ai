import { useState } from "react";
import { useGsapScope } from "@/lib/anim";
import { Reveal } from "./Reveal";

const PROMPTS = [
  {
    q: "800 sq m plot, 4 floors, glass envelope, 18 apartments.",
    a: "Massing resolved · FAR 2.1 · 18 units · 3 circulation cores",
  },
  {
    q: "Cut cost by 9% without losing the double-height lobby.",
    a: "Facade spec swapped · slab depth reduced · ₹ 8.7% down",
  },
  {
    q: "Is the north stair compliant for a G+4 residential block?",
    a: "Width 1.2m ✓ · travel distance 27.4m ✓ · pressurisation flagged",
  },
];

export function AIShowcase() {
  const [i, setI] = useState(0);

  const scope = useGsapScope<HTMLElement>(({ gsap, root }) => {
    gsap.fromTo(
      "[data-scan]",
      { yPercent: -110 },
      {
        yPercent: 110,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: true },
      },
    );
    gsap.fromTo(
      "[data-tile]",
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.08,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 70%" },
      },
    );
  }, []);

  return (
    <section
      id="ai"
      ref={scope}
      className="grain relative overflow-hidden bg-ink py-[16vh] text-paper"
    >
      <div
        data-scan
        className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-transparent via-paper/6 to-transparent"
      />
      <div className="relative mx-auto max-w-[1600px] px-6 md:px-10">
        <Reveal className="flex items-baseline justify-between">
          <p className="label !text-paper/60">05 — AI showcase</p>
          <p className="label !text-paper/40 hidden md:block">Floor 05</p>
        </Reveal>

        <Reveal className="mt-[8vh] max-w-3xl">
          <h2 className="display text-[clamp(2rem,5vw,4rem)]">
            Ask the building a question.
          </h2>
        </Reveal>

        <div className="mt-[8vh] grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <ul className="space-y-3">
              {PROMPTS.map((p, idx) => (
                <li key={p.q}>
                  <button
                    onMouseEnter={() => setI(idx)}
                    onClick={() => setI(idx)}
                    className={`w-full rounded-2xl px-6 py-5 text-left text-[15px] leading-relaxed transition-all duration-500 ${
                      i === idx
                        ? "glass-dark text-paper"
                        : "border border-paper/10 text-paper/45 hover:text-paper/80"
                    }`}
                  >
                    {p.q}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <div className="glass-dark relative flex min-h-[46vh] flex-col justify-between overflow-hidden rounded-[28px] p-8 md:p-10">
              <svg
                viewBox="0 0 400 200"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
                aria-hidden="true"
              >
                <g stroke="white" strokeWidth="0.4" fill="none">
                  {Array.from({ length: 21 }).map((_, k) => (
                    <line key={`v${k}`} x1={k * 20} y1="0" x2={k * 20} y2="200" />
                  ))}
                  {Array.from({ length: 11 }).map((_, k) => (
                    <line key={`h${k}`} x1="0" y1={k * 20} x2="400" y2={k * 20} />
                  ))}
                </g>
              </svg>

              <div className="relative">
                <p className="label !text-paper/50">Response</p>
                <p
                  key={i}
                  className="mt-5 text-[clamp(1.3rem,2.6vw,2.1rem)] font-medium leading-tight tracking-tight animate-[fade-in_0.7s_ease-out]"
                >
                  {PROMPTS[i]!.a}
                </p>
              </div>

              <div className="relative mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Latency", "0.9s"],
                  ["Confidence", "97%"],
                  ["Checks run", "412"],
                  ["Revision", "v12"],
                ].map(([k, v]) => (
                  <div data-tile key={k} className="rounded-xl border border-paper/10 p-4">
                    <p className="label !text-paper/40">{k}</p>
                    <p className="mt-1 text-[19px] font-medium tabular-nums">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
