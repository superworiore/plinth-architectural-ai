import { Reveal } from "./Reveal";
import { PROBLEMS, SOLUTIONS } from "./data";

export function Story() {
  return (
    <section id="story" className="relative bg-paper py-[16vh]">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10">
        <Reveal className="flex items-baseline justify-between">
          <p className="label">02 — Problem & Solution</p>
          <p className="label hidden md:block">Floor 02</p>
        </Reveal>
        <div className="hairline-x mt-6" />

        <Reveal className="mt-[8vh] max-w-3xl">
          <h2 className="display text-[clamp(2rem,5vw,4.25rem)] text-ink">
            The AEC industry draws the same building four times.
          </h2>
          <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-graphite">
            Design, structure, cost and compliance live in separate files that
            disagree. PLINTH collapses them into one.
          </p>
        </Reveal>

        <div className="mt-[10vh] grid gap-16 lg:grid-cols-2 lg:gap-24">
          <div>
            <p className="label">Today</p>
            <ul className="mt-8 border-t border-border">
              {PROBLEMS.map((p, i) => (
                <Reveal as="li" key={p.k} delay={i * 70} className="border-b border-border py-7">
                  <p className="text-[19px] font-medium tracking-tight text-ink md:text-[22px]">
                    {p.k}
                  </p>
                  <p className="mt-2 max-w-md text-[15px] leading-relaxed text-graphite">
                    {p.v}
                  </p>
                </Reveal>
              ))}
            </ul>
          </div>

          <div>
            <p className="label !text-brass">With PLINTH</p>
            <ul className="mt-8 border-t border-border">
              {SOLUTIONS.map((s, i) => (
                <Reveal as="li" key={s.k} delay={i * 70} className="border-b border-border py-7">
                  <p className="text-[19px] font-medium tracking-tight text-ink md:text-[22px]">
                    {s.k}
                  </p>
                  <p className="mt-2 max-w-md text-[15px] leading-relaxed text-graphite">
                    {s.v}
                  </p>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
