import { createFileRoute, Link } from "@tanstack/react-router";
import exterior from "@/assets/exterior-render.jpg";
import { Bar, PageHeader, Panel, Status } from "@/components/plinth/dashboard/ui";
import { useProjects } from "@/hooks/use-api";

export const Route = createFileRoute("/app/projects")({
  head: () => ({
    meta: [
      { title: "Projects — PLINTH" },
      { name: "description", content: "Studio project register with phase, location and progress across residential, commercial and hospitality work." },
    ],
  }),
  component: Projects,
});

function Projects() {
  const { data } = useProjects();
  const projectList = (data?.projects && data.projects.length > 0)
    ? data.projects
    : [
        { id: "1", name: "Residence 01 — Shah Villa", code: "PLT-2026-001", typology: "residential", location: "Koramangala, Bangalore", progress: 0.42, status: "design" },
        { id: "2", name: "Studio Kavya", code: "PLT-2026-002", typology: "commercial", location: "Koregaon Park, Pune", progress: 0.88, status: "construction" },
        { id: "3", name: "Kadamba Retreat", code: "PLT-2026-003", typology: "hospitality", location: "Madikeri, Coorg", progress: 0.34, status: "draft" },
        { id: "4", name: "Halcyon Offices", code: "PLT-2026-004", typology: "mixed_use", location: "Gachibowli, Hyderabad", progress: 0.51, status: "review" },
      ];

  return (
    <div className="pb-8">
      <PageHeader index="01 — Projects" title="Studio register" desc={`${projectList.length} active commissions. Progress is derived from the model, not from a manual status field.`} />

      <div className="p-4">
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-border">
              {projectList.map((p) => (
                <li key={p.id}>
                  <Link to="/app" className="grid items-center gap-4 p-4 transition-colors hover:bg-secondary md:grid-cols-[96px_1.4fr_1fr_140px_1fr_100px]">
                    <img src={exterior} alt="" width={192} height={128} loading="lazy" className="hidden h-16 w-24 border border-border object-cover md:block" />
                    <span>
                      <span className="block text-[14px]">{p.name}</span>
                      <span className="label-tech">{p.code}</span>
                    </span>
                    <span className="text-[13px] text-muted-foreground">{p.typology.replace('_', ' ')}</span>
                    <span className="label-tech">{p.location ?? '—'}</span>
                    <span>
                      <span className="mb-2 block font-mono text-[11px]">{Math.round(p.progress * 100)}%</span>
                      <Bar value={p.progress} tone={p.progress > 0.8 ? "moss" : "ink"} />
                    </span>
                    <span className="md:text-right">
                      <Status tone={p.status === "completed" ? "ok" : "neutral"}>{p.status.replace('_', ' ')}</Status>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
        </Panel>
      </div>
    </div>
  );
}
