import { useGsapScope } from "@/lib/anim";
import { Reveal } from "./Reveal";

const PLATES = [
  { src: "/assets/glass.jpg", label: "Envelope study", alt: "Glass curtain wall of a modern building" },
  { src: "/assets/frame.jpg", label: "Structural frame", alt: "Exposed concrete and steel frame" },
  { src: "/assets/final.jpg", label: "Completed volume", alt: "Finished luxury building exterior" },
];

/** Floating architecture plates with perspective + image masking. */
export function Showcase3D() {
  const scope = useGsapScope<HTMLElement>(({ gsap, root }) => {
    const plates = gsap.utils.toArray<HTMLElement>("[data-plate3d]", root);

    gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "+=320%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    })
      .fromTo(
        plates,
        {
          yPercent: 60,
          opacity: 0,
          rotateX: 24,
          rotateZ: (idx: number) => (idx - 1) * 5,
          scale: 0.86,
          transformPerspective: 1400,
        },
        {
          yPercent: 0,
          opacity: 1,
          rotateX: 0,
          rotateZ: (idx: number) => (idx - 1) * 2,
          scale: 1,
          stagger: 0.18,
          ease: "power2.out",
        },
        0,
      )
      .to(plates, { yPercent: -16, stagger: 0.12, ease: "none" }, 0.55)
      .fromTo("[data-caption]", { opacity: 0, y: 30 }, { opacity: 1, y: 0 }, 0.35);

    const onMove = (e: PointerEvent) => {
      const rx = (e.clientY / window.innerHeight - 0.5) * -6;
      const ry = (e.clientX / window.innerWidth - 0.5) * 8;
      gsap.to("[data-stack]", {
        rotateX: rx,
        rotateY: ry,
        duration: 1.2,
        ease: "power2.out",
        transformPerspective: 1400,
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <section
      id="spatial"
      ref={scope}
      className="relative h-svh overflow-hidden bg-mist"
    >
      <div className="absolute inset-x-0 top-[10vh] mx-auto w-full max-w-[1600px] px-6 md:px-10">
        <div className="flex items-baseline justify-between">
          <p className="label">06 — Spatial showcase</p>
          <p className="label hidden md:block">Floor 06</p>
        </div>
      </div>

      <div className="flex h-full items-center justify-center px-6">
        <div
          data-stack
          className="grid w-full max-w-6xl grid-cols-1 gap-6 [transform-style:preserve-3d] md:grid-cols-3 md:gap-8"
        >
          {PLATES.map((p, i) => (
            <figure
              key={p.label}
              data-plate3d
              className="relative overflow-hidden rounded-[26px] lift will-change-transform"
              style={{ transform: `translateZ(${i * 24}px)` }}
            >
              <img
                src={p.src}
                alt={p.alt}
                loading="lazy"
                className="h-[38vh] w-full object-cover transition-transform duration-[1200ms] hover:scale-105 md:h-[52vh]"
              />
              <figcaption className="glass absolute bottom-4 left-4 right-4 rounded-xl px-4 py-3 text-[13px] font-medium text-ink">
                {p.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div
        data-caption
        className="absolute inset-x-0 bottom-[10vh] mx-auto max-w-[1600px] px-6 md:px-10"
      >
        <p className="max-w-lg text-[15px] leading-relaxed text-graphite md:text-[17px]">
          Massing, structure and finish held as one object — rotate, section and
          price any of it without leaving the model.
        </p>
      </div>
    </section>
  );
}
