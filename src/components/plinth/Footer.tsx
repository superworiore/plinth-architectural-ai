import { getToken } from "@/lib/api";
import { Reveal } from "./Reveal";
import { FLOORS } from "./data";

export function Footer() {
  function handleOpenPlinth(e: React.MouseEvent) {
    e.preventDefault();
    if (getToken()) {
      window.location.href = "/app";
    } else {
      window.location.href = "/login";
    }
  }

  return (
    <footer className="relative bg-paper pb-10 pt-[14vh]">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10">
        <Reveal>
          <p className="display text-[clamp(3.5rem,18vw,16rem)] leading-[0.8] tracking-[-0.05em] text-ink">
            PLINTH
          </p>
        </Reveal>

        <div className="hairline-x mt-[8vh]" />

        <div className="mt-10 grid gap-10 md:grid-cols-4">
          <div>
            <p className="label">Platform</p>
            <ul className="mt-4 space-y-2">
              {FLOORS.map((f) => (
                <li key={f.id}>
                  <a
                    href={`#${f.id}`}
                    className="text-[14px] text-graphite transition-colors duration-400 hover:text-ink"
                  >
                    {f.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label">Company</p>
            <ul className="mt-4 space-y-2 text-[14px] text-graphite">
              <li>About</li>
              <li>Careers</li>
              <li>Press</li>
              <li>Contact</li>
            </ul>
          </div>
          <div>
            <p className="label">Legal</p>
            <ul className="mt-4 space-y-2 text-[14px] text-graphite">
              <li>Privacy</li>
              <li>Terms</li>
              <li>Security</li>
            </ul>
          </div>
          <div>
            <p className="label">Private preview</p>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-graphite">
              Studios, developers and contractors — access opens in cohorts.
            </p>
            <button
              onClick={handleOpenPlinth}
              className="mt-5 inline-flex rounded-full border border-ink px-5 py-2.5 text-[13px] font-medium text-ink transition-all duration-500 hover:bg-ink hover:text-paper"
            >
              Open PLINTH
            </button>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-2 text-[12px] text-graphite md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} PLINTH. Architecture, computed.</p>
          <p>Designed as an interactive architectural exhibition.</p>
        </div>
      </div>
    </footer>
  );
}
