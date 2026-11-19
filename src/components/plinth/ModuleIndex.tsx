import { useGsapScope } from "@/lib/anim";
import { Reveal } from "./Reveal";
import { MODULES } from "./data";

export function ModuleIndex() {
  const scope = useGsapScope<HTMLElement>(({ gsap, root }) => {
    gsap.fromTo(
      "[data-mod]",
      { opacity: 0, y: 40, filter: "blur(10px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.9,
        stagger: 0.05,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 72%" },
      },
    );
  }, []);

  return (
    <section id="index" ref={scope} className="relative bg-paper py-[16vh]">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10">
        <Reveal className="flex items-baseline justify-between">
          <p className="label">05 — Modules</p>
          <p className="label hidden md:block">Thirteen</p>
        </Reveal>
        <div className="hairline-x mt-6" />

        <Reveal className="mt-[8vh] max-w-3xl">
          <h2 className="display text-[clamp(2rem,5vw,4.25rem)] text-ink">
            Thirteen modules. One file.
          </h2>
        </Reveal>

        <div className="mt-[10vh] grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <article
              key={m.n}
              data-mod
              className="group bg-paper p-8 transition-colors duration-500 hover:bg-mist md:p-10"
            >
              <p className="text-[11px] tabular-nums tracking-[0.3em] text-brass">
                {m.n}
              </p>
              <h3 className="mt-6 text-[20px] font-medium tracking-tight text-ink md:text-[23px]">
                {m.k}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-graphite md:text-[15px]">
                {m.v}
              </p>
              <span className="mt-8 block h-px w-6 bg-border transition-all duration-500 group-hover:w-14 group-hover:bg-brass" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
