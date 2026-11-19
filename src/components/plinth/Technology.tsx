import { useGsapScope } from "@/lib/anim";
import { Reveal } from "./Reveal";
import { TECH } from "./data";

export function Technology() {
  const scope = useGsapScope<HTMLElement>(({ gsap, root }) => {
    gsap.fromTo(
      "[data-tech]",
      { opacity: 0, y: 50, filter: "blur(10px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1,
        stagger: 0.07,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 72%" },
      },
    );
    gsap.to("[data-mark]", {
      rotate: 180,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: true },
    });
  }, []);

  return (
    <section id="technology" ref={scope} className="relative bg-mist py-[16vh]">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10">
        <Reveal className="flex items-baseline justify-between">
          <p className="label">08 — Technology</p>
          <p className="label hidden md:block">Floor 08</p>
        </Reveal>
        <div className="hairline-x mt-6" />

        <div className="mt-[8vh] flex items-start justify-between gap-10">
          <Reveal className="max-w-2xl">
            <h2 className="display text-[clamp(2rem,5vw,4rem)] text-ink">
              Built like infrastructure, not a plugin.
            </h2>
          </Reveal>
          <svg
            data-mark
            viewBox="0 0 100 100"
            className="hidden h-24 w-24 shrink-0 md:block"
            aria-hidden="true"
          >
            <rect x="10" y="10" width="80" height="80" fill="none" stroke="var(--ink)" strokeWidth="0.6" />
            <rect x="30" y="30" width="40" height="40" fill="none" stroke="var(--ink)" strokeWidth="0.6" />
            <line x1="10" y1="10" x2="90" y2="90" stroke="var(--ink)" strokeWidth="0.4" />
            <line x1="90" y1="10" x2="10" y2="90" stroke="var(--ink)" strokeWidth="0.4" />
          </svg>
        </div>

        <div className="mt-[8vh] grid gap-px overflow-hidden rounded-[28px] bg-border md:grid-cols-3">
          {TECH.map((t) => (
            <div
              key={t.k}
              data-tech
              className="group bg-paper p-8 transition-colors duration-500 hover:bg-ink md:p-10"
            >
              <p className="label transition-colors duration-500 group-hover:!text-paper/50">
                {t.k}
              </p>
              <p className="mt-4 text-[18px] font-medium leading-snug tracking-tight text-ink transition-colors duration-500 group-hover:text-paper md:text-[21px]">
                {t.v}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
