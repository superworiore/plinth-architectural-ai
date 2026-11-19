import { useEffect, useRef } from "react";
import { useGsapScope } from "@/lib/anim";

const STAGES = [
  { at: 0.06, label: "Ground", line: "A site. Coordinates. Nothing built." },
  { at: 0.3, label: "Structure", line: "Foundations, grid, load paths." },
  { at: 0.56, label: "Envelope", line: "Concrete, steel, glass." },
  { at: 0.8, label: "Alive", line: "Light, landscape, occupancy." },
];

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Scroll writes a target time; a rAF loop eases the video toward it so the
  // decoder never gets a burst of seeks (the cause of the stutter).
  const target = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    const stop = () => v.pause();
    v.addEventListener("play", stop);

    let raf = 0;
    let current = 0;
    let seeking = false;
    const onSeeked = () => {
      seeking = false;
    };
    v.addEventListener("seeked", onSeeked);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!v.duration || Number.isNaN(v.duration)) return;
      current += (target.current - current) * 0.12;
      if (seeking) return;
      if (Math.abs(current - v.currentTime) < 1 / 60) return;
      seeking = true;
      if (typeof v.fastSeek === "function") v.fastSeek(current);
      else v.currentTime = current;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", stop);
      v.removeEventListener("seeked", onSeeked);
    };
  }, []);


  const scope = useGsapScope<HTMLDivElement>(({ gsap, root }) => {
    const v = videoRef.current;
    const stageEls = gsap.utils.toArray<HTMLElement>("[data-stage]", root);

    // The draw-on architectural line, then the reveal of the render.
    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .fromTo(
        "[data-line]",
        { scaleX: 0 },
        { scaleX: 1, duration: 1.8, ease: "expo.inOut" },
      )
      .fromTo(
        "[data-blueprint] path, [data-blueprint] line, [data-blueprint] rect",
        { opacity: 0 },
        { opacity: 1, duration: 1.2, stagger: 0.04 },
        "-=0.9",
      )
      .fromTo(
        "[data-word]",
        { yPercent: 120, opacity: 0, filter: "blur(18px)" },
        {
          yPercent: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: 1.5,
          stagger: 0.09,
        },
        "-=0.8",
      )
      .fromTo(
        "[data-sub]",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1.2 },
        "-=1",
      )
      .fromTo(
        "[data-stagevideo]",
        { opacity: 0, scale: 1.12, filter: "blur(24px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 2 },
        "-=1.2",
      )
      .to("[data-blueprint]", { opacity: 0.22, duration: 1.4 }, "-=1.6");

    // Scroll-scrubbed construction sequence.
    const st = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "+=520%",
        pin: true,
        scrub: 1.4,
        anticipatePin: 1,
        onUpdate: (self) => {
          if (v && v.duration) {
            const p = Math.min(self.progress / 0.86, 1);
            target.current = p * (v.duration - 0.05);
          }

          stageEls.forEach((el) => {
            const at = Number(el.dataset["at"]);
            const active = self.progress >= at && self.progress < at + 0.24;
            el.dataset["on"] = String(active);
          });
        },
      },
    });

    st.to("[data-title]", { opacity: 0, y: -80, filter: "blur(14px)" }, 0)
      .to("[data-blueprint]", { opacity: 0 }, 0)
      .to("[data-scrollcue]", { opacity: 0 }, 0)
      .to("[data-stagevideo]", { scale: 1.06 }, 0)
      // camera pushes through the entrance and blooms into the digital world
      .to("[data-stagevideo]", { scale: 2.4, ease: "power2.in" }, 0.86)
      .to("[data-veil]", { opacity: 1, ease: "power2.in" }, 0.88)
      .fromTo(
        "[data-enter]",
        { opacity: 0, scale: 0.94, filter: "blur(18px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)" },
        0.93,
      );

    return () => {
      intro.kill();
      st.kill();
    };
  }, []);

  return (
    <div
      id="top"
      ref={scope}
      className="relative h-svh w-full overflow-hidden bg-paper"
    >
      {/* Construction render, scrubbed by scroll */}
      <div
        data-stagevideo
        className="absolute inset-0 origin-[50%_62%] will-change-transform"
      >
        <video
          ref={videoRef}
          src="/assets/construction.mp4"
          poster="/assets/plot.jpg"
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-ink/25" />
        <div className="absolute inset-x-0 top-0 h-[38vh] bg-gradient-to-b from-ink/45 to-transparent" />
      </div>

      {/* Blueprint overlay */}
      <svg
        data-blueprint
        viewBox="0 0 1000 600"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        aria-hidden="true"
      >
        <g stroke="white" strokeWidth="0.6" fill="none" opacity="0.7">
          <rect x="300" y="200" width="400" height="240" />
          <rect x="340" y="240" width="140" height="160" />
          <rect x="520" y="240" width="140" height="70" />
          <rect x="520" y="330" width="140" height="70" />
          <line x1="300" y1="320" x2="700" y2="320" />
          <line x1="500" y1="200" x2="500" y2="440" />
          <line x1="180" y1="440" x2="820" y2="440" />
          <line x1="300" y1="200" x2="240" y2="140" />
          <line x1="700" y1="200" x2="760" y2="140" />
          <rect x="240" y="140" width="520" height="60" />
        </g>
      </svg>

      {/* Single architectural line */}
      <div
        data-line
        className="absolute left-1/2 top-1/2 h-px w-[64vw] origin-center -translate-x-1/2 bg-paper/70"
      />

      {/* Title */}
      <div
        data-title
        className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
      >
        <div className="overflow-hidden">
          <p data-sub className="label !text-paper/70 mb-6">
            Architecture, computed
          </p>
        </div>
        <h1 className="display flex flex-wrap justify-center gap-x-[0.06em] text-paper text-[clamp(3.5rem,15vw,13rem)]">
          {"PLINTH".split("").map((c, i) => (
            <span key={i} className="overflow-hidden pb-[0.06em]">
              <span data-word className="block">
                {c}
              </span>
            </span>
          ))}
        </h1>
        <p
          data-sub
          className="mt-8 max-w-xl text-[15px] leading-relaxed text-paper/75 md:text-[17px]"
        >
          An AI platform that carries a building from bare ground to issued
          drawings — one continuous model, every discipline inside it.
        </p>
      </div>

      {/* Stage captions during the scrub */}
      <div className="pointer-events-none absolute bottom-24 left-6 md:left-10">
        {STAGES.map((s) => (
          <div
            key={s.label}
            data-stage
            data-at={s.at}
            data-on="false"
            className="absolute bottom-0 left-0 max-w-sm transition-all duration-700 data-[on=false]:translate-y-4 data-[on=false]:opacity-0 data-[on=true]:translate-y-0 data-[on=true]:opacity-100"
          >
            <p className="label !text-paper/60">{s.label}</p>
            <p className="mt-2 text-[22px] font-medium leading-snug tracking-tight text-paper md:text-[30px]">
              {s.line}
            </p>
          </div>
        ))}
      </div>

      <div
        data-scrollcue
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <span className="label !text-paper/60">Scroll to build</span>
        <span className="h-10 w-px animate-pulse bg-paper/50" />
      </div>

      {/* White veil → entering the digital world */}
      <div
        data-veil
        className="pointer-events-none absolute inset-0 bg-paper opacity-0"
      />
      <div
        data-enter
        className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center opacity-0"
      >
        <div>
          <p className="label">Entrance</p>
          <p className="display mt-4 text-[clamp(2rem,6vw,4.5rem)] text-ink">
            Welcome inside.
          </p>
        </div>
      </div>
    </div>
  );
}
