import { getToken } from "@/lib/api";
import { useGsapScope } from "@/lib/anim";
import { Reveal } from "./Reveal";

export function FutureVision() {
  const scope = useGsapScope<HTMLElement>(({ gsap, root }) => {
    gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "+=200%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    })
      .fromTo("[data-bg]", { scale: 1.25, filter: "blur(16px)" }, { scale: 1, filter: "blur(0px)" }, 0)
      .fromTo(
        "[data-l]",
        { opacity: 0, yPercent: 100, filter: "blur(16px)" },
        { opacity: 1, yPercent: 0, filter: "blur(0px)", stagger: 0.25 },
        0.1,
      )
      .to("[data-cta]", { opacity: 1, y: 0 }, 0.65);
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
    <section
      id="future"
      ref={scope}
      className="relative h-svh overflow-hidden bg-ink text-paper"
    >
      <img
        data-bg
        src="/assets/final.jpg"
        alt="Completed luxury building at dusk"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/30" />

      <div className="relative flex h-full flex-col justify-between py-[12vh]">
        <div className="mx-auto w-full max-w-[1600px] px-6 md:px-10">
          <p className="label !text-paper/60">09 — Future vision</p>
        </div>

        <div className="mx-auto w-full max-w-[1600px] px-6 md:px-10">
          <h2 className="display text-[clamp(2.2rem,7vw,6rem)]">
            {["Every building", "will be reasoned about", "before it is poured."].map(
              (l) => (
                <span key={l} className="block overflow-hidden">
                  <span data-l className="block">
                    {l}
                  </span>
                </span>
              ),
            )}
          </h2>
        </div>

        <div className="mx-auto w-full max-w-[1600px] px-6 md:px-10">
          <div
            data-cta
            className="flex flex-col gap-6 opacity-0 md:flex-row md:items-end md:justify-between"
          >
            <p className="max-w-md text-[15px] leading-relaxed text-paper/65">
              PLINTH is in private preview with studios, developers and
              contractors. Access opens in cohorts.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleOpenPlinth}
                className="rounded-full bg-paper px-8 py-4 text-[14px] font-medium tracking-tight text-ink transition-transform duration-500 hover:-translate-y-0.5"
              >
                Open PLINTH
              </button>
              <a
                href="#index"
                className="rounded-full border border-paper/25 px-7 py-4 text-[14px] font-medium text-paper transition-colors duration-500 hover:border-paper"
              >
                See the modules
              </a>
            </div>

          </div>
        </div>
      </div>

      <Reveal className="sr-only">Future vision of PLINTH</Reveal>
    </section>
  );
}
