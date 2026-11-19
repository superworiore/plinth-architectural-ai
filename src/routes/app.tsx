import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Wordmark } from "@/components/plinth/dashboard/site-chrome";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-api";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const ROLES_LIST = [
  { id: "architect", label: "Architect", focus: ["Floor Planner", "AI Assistant", "Site Analysis"] },
  { id: "project_admin", label: "Project Admin", focus: ["Overview", "Projects", "Compliance"] },
  { id: "client", label: "Client", focus: ["Overview", "Cost & Materials", "Visualization"] },
  { id: "structural", label: "Structural Engineer", focus: ["Compliance", "Documents"] },
  { id: "interior", label: "Interior Designer", focus: ["Interior Studio", "Visualization"] },
  { id: "builder", label: "Builder / Contractor", focus: ["Cost & Materials", "Documents"] },
];

const nav: { group: string; items: { to: string; label: string; code: string }[] }[] = [
  {
    group: "Studio",
    items: [
      { to: "/app", label: "Overview", code: "00" },
      { to: "/app/projects", label: "Projects", code: "01" },
    ],
  },
  {
    group: "Design",
    items: [
      { to: "/app/floor-planner", label: "Floor Planner", code: "02" },
      { to: "/app/interior", label: "Interior Studio", code: "03" },
      { to: "/app/visualization", label: "Visualization", code: "04" },
      { to: "/app/site-analysis", label: "Site Analysis", code: "05" },
    ],
  },
  {
    group: "Delivery",
    items: [
      { to: "/app/cost", label: "Cost & Materials", code: "06" },
      { to: "/app/compliance", label: "Compliance", code: "07" },
      { to: "/app/collaboration", label: "Collaboration", code: "08" },
      { to: "/app/documents", label: "Documents", code: "09" },
    ],
  },
  {
    group: "Intelligence",
    items: [{ to: "/app/assistant", label: "AI Assistant", code: "10" }],
  },
];

function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { data: projectsData } = useProjects();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [activeRole, setActiveRole] = useState(() => {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      try {
        return localStorage.getItem("plinth_user_role") || user?.role || "architect";
      } catch {
        return user?.role || "architect";
      }
    }
    return user?.role || "architect";
  });

  useEffect(() => {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
      try {
        localStorage.setItem("plinth_user_role", activeRole);
      } catch {
        // ignore
      }
    }
  }, [activeRole]);

  const currentProject = projectsData?.projects?.[0];
  const roleObj = ROLES_LIST.find((r) => r.id === activeRole) ?? ROLES_LIST[0]!;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* top bar */}
      <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-4 border-b border-border bg-background px-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="label-tech lg:hidden"
          aria-label="Toggle navigation"
        >
          Menu
        </button>
        <Link to="/" className="flex items-center gap-2.5">
          <span className="block h-2.5 w-2.5 border border-foreground" aria-hidden />
          <Wordmark className="text-[12px]" />
        </Link>
        <span className="hidden h-4 w-px bg-border sm:block" />

        {/* Live Project info */}
        <div className="hidden min-w-0 items-baseline gap-3 sm:flex">
          <span className="truncate text-[13px] font-medium">
            {currentProject?.name || "Residence 01 — Shah Villa"}
          </span>
          <span className="label-tech truncate">
            {currentProject?.code || "PLT-2026-001"} · {currentProject?.location || "Bangalore, KA"}
          </span>
        </div>

        {/* Role Selector & User Actions */}
        <div className="ml-auto flex items-center gap-3">
          {/* Discipline Role Selector */}
          <div className="flex items-center gap-1.5 border border-border bg-secondary/50 px-2 py-1">
            <span className="label-tech text-[10px]">Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value)}
              className="bg-transparent text-[11px] font-medium outline-none cursor-pointer"
            >
              {ROLES_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <span className="hidden h-4 w-px bg-border md:block" />

          {/* User Name & Logout */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground hidden sm:inline">
              {user?.full_name || "Sneha Iyer"}
            </span>
            <button
              onClick={logout}
              title="Sign Out"
              className="h-7 border border-border px-2 text-[10px] font-mono text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside
          className={cn(
            "z-30 w-56 shrink-0 border-r border-border bg-sidebar",
            "fixed inset-y-12 left-0 overflow-y-auto transition-transform lg:sticky lg:top-12 lg:h-[calc(100vh-3rem)] lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="py-4">
            {nav.map((g) => (
              <div key={g.group} className="mb-5">
                <p className="label-tech px-4 pb-2">{g.group}</p>
                <ul>
                  {g.items.map((it) => {
                    const active =
                      it.to === "/app" ? pathname === "/app" || pathname === "/app/" : pathname.startsWith(it.to);
                    const isFocus = roleObj.focus.includes(it.label);
                    return (
                      <li key={it.to}>
                        <Link
                          to={it.to}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 border-l-2 px-4 py-2 text-[13px] transition-colors relative",
                            active
                              ? "border-accent bg-sidebar-accent text-foreground"
                              : "border-transparent text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                          )}
                        >
                          <span className="font-mono text-[10px] opacity-60">{it.code}</span>
                          <span className="flex-1">{it.label}</span>
                          {isFocus && (
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" title={`Recommended for ${roleObj.label}`} />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-border p-4 space-y-2">
            <p className="label-tech">Discipline Mode</p>
            <p className="text-[12px] font-medium text-foreground">{roleObj.label}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Recommended modules highlighted with indicator.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
