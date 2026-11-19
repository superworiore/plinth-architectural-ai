import { useGsapScope } from "@/lib/anim";
import { Reveal } from "./Reveal";

export function Vision() {
  const scope = useGsapScope<HTMLElement>(({ gsap, root }) => {
    gsap.utils.toArray<HTMLElement>("[data-parallax]", root).forEach((el) => {
      gsap.to(el, {
        yPercent: Number(el.dataset["parallax"]),
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    gsap.utils.toArray<HTMLElement>("[data-word-line]", root).forEach((el) => {
      gsap.fromTo(
        el.querySelectorAll("span"),
        { opacity: 0.12, filter: "blur(6px)" },
        {
          opacity: 1,
          filter: "blur(0px)",
          stagger: 0.06,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 45%", scrub: true },
        },
      );
    });
  }, []);

  const copy =
    "Every building begins as an argument about space. PLINTH holds that argument in a single model — measurable, compliant, priced, buildable.";

  return (
    <section id="vision" ref={scope} className="relative bg-paper py-[16vh] md:py-[22vh]">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10">
        <Reveal className="flex items-baseline justify-between">
          <p className="label">01 — Vision</p>
          <p className="label hidden md:block">Floor 01</p>
        </Reveal>
        <div className="hairline-x mt-6" />

        <div className="mt-[10vh] grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2
              data-word-line
              className="display text-[clamp(1.9rem,4.4vw,3.6rem)] text-ink"
            >
              {copy.split(" ").map((w, i) => (
                <span key={i} className="inline-block">
                  {w}&nbsp;
                </span>
              ))}
            </h2>

            <div className="mt-16 grid gap-10 sm:grid-cols-2">
              {[
                {
                  k: "One model",
                  v: "Design, structure, cost and compliance read from the same geometry.",
                },
                {
                  k: "One language",
                  v: "Eight roles, one project graph, no re-drawn drawings.",
                },
              ].map((x, i) => (
                <Reveal key={x.k} delay={i * 120}>
                  <p className="text-[17px] font-medium text-ink">{x.k}</p>
                  <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-graphite">
                    {x.v}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <Reveal className="relative overflow-hidden rounded-[28px] lift">
              <img
                data-parallax="-8"
                src="/assets/frame.jpg"
                alt="Concrete and steel frame of a building under construction"
                loading="lazy"
                className="h-[62vh] w-full scale-110 object-cover"
              />
              <div className="glass absolute bottom-5 left-5 right-5 rounded-2xl px-5 py-4">
                <p className="label">Structure — stage 02</p>
                <p className="mt-1 text-[15px] font-medium text-ink">
                  Grid resolved, spans validated, quantities live.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
