import { useEffect, useRef } from "react";
import { useGsapScope } from "@/lib/anim";

const SCENES = [
  { at: 0.04, label: "01 — Blueprint", line: "A drawing. Dimensions. Nothing built yet." },
  { at: 0.22, label: "02 — Floor plate", line: "Circulation, cores, structural grid." },
  { at: 0.42, label: "03 — Structure", line: "Steel frame, long spans, load paths." },
  { at: 0.6, label: "04 — Envelope", line: "Glass, concrete, architectural light." },
  { at: 0.76, label: "05 — Headquarters", line: "Atrium, sky gardens, occupancy." },
];

const ORBIT = [
  "Plot analysis",
  "Floor plan AI",
  "3D generation",
  "Interior AI",
  "Cost & BOQ",
  "Compliance",
];

export function Cinematic() {
  const videoRef = useRef<HTMLVideoElement>(null);
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
      current += (target.current - current) * 0.1;
      if (seeking) return;
      if (Math.abs(current - v.currentTime) < 1 / 50) return;
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
    const sceneEls = gsap.utils.toArray<HTMLElement>("[data-scene]", root);

    const intro = gsap.timeline({
      defaults: { ease: "power3.out" },
      delay: 0.35,
    });
    intro
      .fromTo("[data-line]", { scaleX: 0 }, { scaleX: 1, duration: 1.7, ease: "expo.inOut" })
      .fromTo(
        "[data-grid] line",
        { opacity: 0 },
        { opacity: 1, duration: 1, stagger: 0.02 },
        "-=1.1",
      )
      .fromTo(
        "[data-word]",
        { yPercent: 120, opacity: 0, filter: "blur(18px)" },
        { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 1.5, stagger: 0.08 },
        "-=0.8",
      )
      .fromTo("[data-sub]", { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.2 }, "-=1")
      .fromTo(
        "[data-stage]",
        { opacity: 0, scale: 1.14, filter: "blur(26px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 2.1 },
        "-=1.3",
      )
      .to("[data-grid]", { opacity: 0.18, duration: 1.3 }, "-=1.6");

    const st = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "+=780%",
        pin: true,
        scrub: 1.2,
        anticipatePin: 1,
        onUpdate: (self) => {
          if (v && v.duration) {
            const p = Math.min(self.progress / 0.84, 1);
            target.current = p * (v.duration - 0.05);
          }
          sceneEls.forEach((el) => {
            const at = Number(el.dataset["at"]);
            const on = self.progress >= at && self.progress < at + 0.16;
            el.dataset["on"] = String(on);
          });
        },
      },
    });

    st
      // camera drift + depth across the whole sequence
      .to("[data-title]", { opacity: 0, yPercent: -12, filter: "blur(16px)" }, 0)
      .to("[data-grid]", { opacity: 0 }, 0)
      .to("[data-cue]", { opacity: 0 }, 0)
      .fromTo("[data-stage]", { scale: 1.08 }, { scale: 1, ease: "none" }, 0)
      .fromTo("[data-stage]", { yPercent: 2 }, { yPercent: -2, ease: "none" }, 0)
      // masked plate: structure
      .fromTo(
        "[data-plate='a']",
        { clipPath: "inset(50% 0% 50% 0%)", opacity: 0, yPercent: 8 },
        { clipPath: "inset(0% 0% 0% 0%)", opacity: 1, yPercent: 0, ease: "power2.out" },
        0.3,
      )
      .to("[data-plate='a']", { opacity: 0, yPercent: -10, filter: "blur(14px)" }, 0.44)
      // masked plate: envelope
      .fromTo(
        "[data-plate='b']",
        { clipPath: "inset(0% 50% 0% 50%)", opacity: 0, scale: 1.1 },
        { clipPath: "inset(0% 0% 0% 0%)", opacity: 1, scale: 1, ease: "power2.out" },
        0.56,
      )
      .to("[data-plate='b']", { opacity: 0, scale: 1.06, filter: "blur(16px)" }, 0.7)
      // rotation / perspective register
      .fromTo(
        "[data-tilt]",
        { rotateX: 8, rotateY: -6, transformPerspective: 1600 },
        { rotateX: 0, rotateY: 0, ease: "none" },
        0.1,
      )
      // camera pushes through the entrance
      .to("[data-stage]", { scale: 2.3, ease: "power2.in" }, 0.84)
      .to("[data-veil]", { opacity: 1, ease: "power2.in" }, 0.865)
      .fromTo(
        "[data-enter]",
        { opacity: 0, scale: 0.94, filter: "blur(20px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)" },
        0.9,
      )
      .fromTo(
        "[data-orbit]",
        { opacity: 0, y: 26, filter: "blur(12px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", stagger: 0.03 },
        0.93,
      );

    return () => {
      intro.kill();
      st.kill();
    };
  }, []);

  return (
    <div id="top" ref={scope} className="relative h-svh w-full overflow-hidden bg-paper">
      <div data-tilt className="absolute inset-0">
        <div data-stage className="absolute inset-0 origin-[50%_60%] will-change-transform">
          <video
            ref={videoRef}
            src="/assets/cinematic.mp4"
            poster="/assets/blueprint.jpg"
            muted
            playsInline
            preload="auto"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-ink/22" />
          <div className="absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-ink/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[45vh] bg-gradient-to-t from-ink/55 to-transparent" />
        </div>
      </div>

      {/* Masked architectural plates */}
      <figure
        data-plate="a"
        className="absolute right-[6vw] top-1/2 hidden h-[52vh] w-[30vw] -translate-y-1/2 overflow-hidden opacity-0 lift md:block"
      >
        <img
          src="/assets/facade.jpg"
          alt="Structural steel frame of a multi-storey commercial building"
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </figure>
      <figure
        data-plate="b"
        className="absolute left-[6vw] top-1/2 hidden h-[46vh] w-[26vw] -translate-y-1/2 overflow-hidden opacity-0 lift md:block"
      >
        <img
          src="/assets/atrium.jpg"
          alt="Glass and concrete atrium of a technology headquarters"
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </figure>

      {/* Blueprint grid */}
      <svg
        data-grid
        viewBox="0 0 200 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        aria-hidden="true"
      >
        <g stroke="white" strokeWidth="0.12" opacity="0.55">
          {Array.from({ length: 21 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="120" />
          ))}
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 10} x2="200" y2={i * 10} />
          ))}
        </g>
      </svg>

      <div
        data-line
        className="absolute left-1/2 top-1/2 h-px w-[66vw] origin-center -translate-x-1/2 bg-paper/70"
      />

      {/* Title */}
      <div
        data-title
        className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
      >
        <p data-sub className="label !text-paper/70 mb-6">
          Architecture, computed
        </p>
        <h1 className="display flex flex-wrap justify-center gap-x-[0.06em] text-paper text-[clamp(3.4rem,15vw,13rem)]">
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
          An AI platform that carries a commercial building from bare ground to
          issued drawings — one continuous model, every discipline inside it.
        </p>
      </div>

      {/* Scene captions */}
      <div className="pointer-events-none absolute bottom-24 left-6 md:left-10">
        {SCENES.map((s) => (
          <div
            key={s.label}
            data-scene
            data-at={s.at}
            data-on="false"
            className="absolute bottom-0 left-0 max-w-md transition-all duration-700 data-[on=false]:translate-y-5 data-[on=false]:opacity-0 data-[on=false]:blur-[6px] data-[on=true]:translate-y-0 data-[on=true]:opacity-100 data-[on=true]:blur-0"
          >
            <p className="label !text-paper/60">{s.label}</p>
            <p className="mt-2 text-[22px] font-medium leading-snug tracking-tight text-paper md:text-[32px]">
              {s.line}
            </p>
          </div>
        ))}
      </div>

      <div
        data-cue
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <span className="label !text-paper/60">Scroll to build</span>
        <span className="h-10 w-px animate-pulse bg-paper/50" />
      </div>

      {/* Veil → PLINTH ecosystem */}
      <div data-veil className="pointer-events-none absolute inset-0 bg-paper opacity-0" />
      <div
        data-enter
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center opacity-0"
      >
        <p className="label">The ecosystem</p>
        <p className="display mt-4 text-[clamp(2rem,6.5vw,5rem)] text-ink">
          Welcome inside PLINTH.
        </p>
        <div className="mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
          {ORBIT.map((o) => (
            <span
              key={o}
              data-orbit
              className="glass rounded-full px-4 py-2 text-[12px] tracking-tight text-ink md:text-[13px]"
            >
              {o}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
