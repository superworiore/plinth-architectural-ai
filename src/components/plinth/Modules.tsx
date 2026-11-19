import { useGsapScope } from "@/lib/anim";
import { Reveal } from "./Reveal";
import { CHAPTERS } from "./data";

export function Modules() {
  const scope = useGsapScope<HTMLElement>(({ gsap, root }) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-row]", root);

    rows.forEach((row, i) => {
      gsap.fromTo(
        row,
        {
          opacity: 0,
          y: 70,
          rotateX: 5,
          transformPerspective: 1400,
          filter: "blur(14px)",
        },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          filter: "blur(0px)",
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: { trigger: row, start: "top 85%" },
        },
      );

      gsap.to(row.querySelector("[data-num]"), {
        yPercent: -30 - i * 4,
        ease: "none",
        scrollTrigger: {
          trigger: row,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    });
  }, []);

  return (
    <section id="modules" ref={scope} className="relative bg-paper py-[18vh]">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10">
        <Reveal className="flex items-baseline justify-between">
          <p className="label">04 — Capability</p>
          <p className="label hidden md:block">Floor 04</p>
        </Reveal>
        <div className="hairline-x mt-6" />

        <Reveal className="mt-[10vh] max-w-3xl">
          <h2 className="display text-[clamp(2rem,5vw,4.25rem)] text-ink">
            Five movements, one continuous file.
          </h2>
          <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-graphite">
            Nothing is exported, re-drawn or re-typed between them. The building
            is the single source of truth from ground to issued drawings.
          </p>
        </Reveal>

        <div className="mt-[12vh] border-t border-border">
          {CHAPTERS.map((c) => (
            <article
              key={c.index}
              data-row
              className="group grid grid-cols-12 gap-6 border-b border-border py-[7vh]"
            >
              <span
                data-num
                className="col-span-12 text-[15px] font-medium tracking-[0.4em] text-brass md:col-span-2"
              >
                {c.index}
              </span>
              <h3 className="col-span-12 text-[clamp(1.6rem,4vw,3.1rem)] font-medium leading-[1.05] tracking-tight text-ink md:col-span-5">
                {c.title}
              </h3>
              <div className="col-span-12 md:col-span-5">
                <p className="max-w-md text-[15px] leading-relaxed text-graphite md:text-[17px]">
                  {c.line}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {c.notes.map((n) => (
                    <span
                      key={n}
                      className="rounded-full border border-border px-3.5 py-1.5 text-[11px] tracking-[0.08em] text-graphite transition-colors duration-500 group-hover:border-brass-soft group-hover:text-ink"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
