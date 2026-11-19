import { useGsapScope } from "@/lib/anim";
import { Reveal } from "./Reveal";

const STEPS = [
  { k: "Brief", v: "Plot, program, budget, intent." },
  { k: "Generate", v: "Plans, massing, structure, interiors." },
  { k: "Validate", v: "Compliance, loads, cost, quantities." },
  { k: "Issue", v: "Drawing sets, BOQ, tenders, schedules." },
];

export function Platform() {
  const scope = useGsapScope<HTMLElement>(({ gsap, root }) => {
    const track = root.querySelector<HTMLElement>("[data-track]");
    if (!track) return;

    gsap.to(track, {
      xPercent: -100 * (STEPS.length - 1) / STEPS.length * 0.86,
      ease: "none",
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "+=280%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    });

    gsap.fromTo(
      "[data-plate]",
      { scale: 1.18 },
      {
        scale: 1,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "top top", scrub: true },
      },
    );
  }, []);

  return (
    <section
      id="platform"
      ref={scope}
      className="relative h-svh overflow-hidden bg-ink text-paper"
    >
      <img
        data-plate
        src="/assets/glass.jpg"
        alt="Glass and concrete facade of a completed luxury building"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/40 to-ink" />

      <div className="relative flex h-full flex-col justify-between py-[12vh]">
        <div className="mx-auto w-full max-w-[1600px] px-6 md:px-10">
          <div className="flex items-baseline justify-between">
            <p className="label !text-paper/60">02 — Platform overview</p>
            <p className="label !text-paper/40 hidden md:block">Floor 02</p>
          </div>
          <h2 className="display mt-8 max-w-3xl text-[clamp(2.2rem,6vw,5rem)]">
            The whole project, on one horizontal line.
          </h2>
        </div>

        <div data-track className="flex w-[220vw] gap-6 px-6 md:w-[190vw] md:gap-10 md:px-10">
          {STEPS.map((s, i) => (
            <article
              key={s.k}
              className="glass-dark flex min-h-[34vh] flex-1 flex-col justify-between rounded-[28px] p-8 transition-transform duration-500 hover:-translate-y-2 md:p-10"
            >
              <span className="label !text-paper/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-[clamp(1.6rem,3vw,2.6rem)] font-medium tracking-tight">
                  {s.k}
                </h3>
                <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-paper/65">
                  {s.v}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mx-auto w-full max-w-[1600px] px-6 md:px-10">
          <Reveal className="text-[13px] text-paper/50">
            Continuous, versioned, auditable — from first coordinate to handover.
          </Reveal>
        </div>
      </div>
    </section>
  );
}
