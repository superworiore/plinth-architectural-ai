import { useEffect, useRef, type DependencyList } from "react";

type Gsap = typeof import("gsap")["default"];
type ScrollTriggerType = typeof import("gsap/ScrollTrigger")["ScrollTrigger"];

export type AnimCtx = {
  gsap: Gsap;
  ScrollTrigger: ScrollTriggerType;
  root: HTMLElement;
};

let cache: Promise<{ gsap: Gsap; ScrollTrigger: ScrollTriggerType }> | null = null;

export function loadGsap() {
  if (!cache) {
    cache = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([g, st]) => {
        const gsap = g.default ?? (g as unknown as Gsap);
        gsap.registerPlugin(st.ScrollTrigger);
        return { gsap, ScrollTrigger: st.ScrollTrigger };
      },
    );
  }
  return cache;
}

/**
 * Scoped GSAP effect. Returns a ref to attach to the section root.
 * All animations are reverted automatically on unmount.
 */
export function useGsapScope<T extends HTMLElement = HTMLDivElement>(
  fn: (ctx: AnimCtx) => void | (() => void),
  deps: DependencyList = [],
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    console.log("[GSAP] useGsapScope effect running, root:", ref.current?.id || ref.current?.tagName);
    let cancelled = false;
    let ctx: { revert: () => void } | undefined;
    let cleanup: (() => void) | void;

    loadGsap().then(({ gsap, ScrollTrigger }) => {
      const root = ref.current;
      if (cancelled || !root) {
        console.log("[GSAP] cancelled or no root");
        return;
      }
      console.log("[GSAP] Creating context for:", root.id || root.tagName);
      ctx = gsap.context(() => {
        cleanup = fn({ gsap, ScrollTrigger, root });
      }, root);
      ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      cleanup?.();
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/** Lenis smooth scroll, wired into GSAP's ticker. */
export function useSmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    console.log("[LENIS] useSmoothScroll effect running");

    let destroy = () => {};
    let cancelled = false;

    Promise.all([import("lenis"), loadGsap()]).then(
      ([{ default: Lenis }, { gsap, ScrollTrigger }]) => {
        if (cancelled) return;
        const lenis = new Lenis({
          duration: 1.25,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          touchMultiplier: 1.4,
        });

        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);

        // The Loader sets overflow:hidden on body — ScrollTrigger needs
        // a refresh once that is removed so pins are recalculated.
        const onReady = () => {
          ScrollTrigger.refresh();
        };
        window.addEventListener("plinth:ready", onReady);

        // Fallback refresh in case plinth:ready already fired
        setTimeout(() => ScrollTrigger.refresh(), 2500);

        destroy = () => {
          window.removeEventListener("plinth:ready", onReady);
          lenis.destroy();
        };
      },
    );

    return () => {
      cancelled = true;
      destroy();
    };
  }, []);
}
