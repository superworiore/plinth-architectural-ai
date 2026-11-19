import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Status } from "@/components/plinth/dashboard/ui";
import { useCompliance, useRunCompliance, useProjects } from "@/hooks/use-api";

export const Route = createFileRoute("/app/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance — PLINTH" },
      { name: "description", content: "Byelaw, NBC and ECBC checks evaluated continuously against the current model state." },
    ],
  }),
  component: Compliance,
});

function statusTone(s: string): "ok" | "fail" | "warn" | "neutral" {
  if (s === "passing") return "ok";
  if (s === "failing") return "fail";
  if (s === "not_checked") return "neutral";
  return "warn";
}

function statusLabel(s: string): string {
  if (s === "passing") return "Pass";
  if (s === "failing") return "Fail";
  if (s === "not_checked") return "Not checked";
  return "Review";
}

function Compliance() {
  const { data: projectsData } = useProjects();
  const projectId = projectsData?.projects?.[0]?.id ?? "";
  const { data, isLoading, error: fetchError } = useCompliance(projectId);
  const runCheck = useRunCompliance(projectId);

  const checks = data?.checks ?? [];
  const passingCount = data?.passing ?? 0;
  const failingCount = data?.failing ?? 0;
  const reviewCount = data?.in_review ?? 0;
  const openCount = failingCount + reviewCount;

  return (
    <div className="pb-8">
      <PageHeader
        index="07 — Compliance"
        title="Code checks"
        desc="Data-quality and regulatory pre-checks evaluated against the current project state. Regulatory rules require manual verification by a licensed professional."
        actions={
          <div className="flex items-center gap-2">
            {checks.length > 0 && (
              <>
                <Status tone="ok">{passingCount} pass</Status>
                <Status tone="warn">{reviewCount} review</Status>
                {failingCount > 0 && <Status tone="fail">{failingCount} fail</Status>}
              </>
            )}
            <button
              onClick={() => runCheck.mutate()}
              disabled={runCheck.isPending || !projectId}
              className="h-8 border border-foreground bg-foreground px-3.5 text-[12px] text-background transition-colors hover:bg-transparent hover:text-foreground disabled:opacity-50"
            >
              {runCheck.isPending ? "Running..." : "Run checks"}
            </button>
          </div>
        }
      />

      <div className="p-4">
        <Panel bodyClassName="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground">Loading compliance data...</div>
          ) : fetchError ? (
            <div className="flex items-center justify-center py-20 text-[13px] text-accent">Failed to load compliance data. Please check your connection.</div>
          ) : runCheck.isError ? (
            <div className="flex items-center justify-center py-10 text-[13px] text-accent">
              Compliance run failed. {runCheck.error instanceof Error ? runCheck.error.message : "Please try again."}
            </div>
          ) : checks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <p className="text-[13px] text-muted-foreground">No compliance checks have been run yet.</p>
              <button
                onClick={() => runCheck.mutate()}
                disabled={runCheck.isPending || !projectId}
                className="h-8 border border-foreground bg-foreground px-3.5 text-[12px] text-background transition-colors hover:bg-transparent hover:text-foreground disabled:opacity-50"
              >
                Run first check
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {checks.map((c) => (
                <li key={c.id} className="grid gap-2 px-4 py-4 transition-colors hover:bg-secondary md:grid-cols-[120px_1fr_1fr_120px] md:items-center">
                  <span className="label-tech">{c.rule_code}</span>
                  <span className="text-[13px]">{c.description}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{c.detail ?? '—'}</span>
                  <span className="md:text-right">
                    <Status tone={statusTone(c.status)}>
                      {statusLabel(c.status)}
                    </Status>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 px-4 md:grid-cols-2">
        <Panel title="Failing item" meta={checks.find(c => c.status === 'failing')?.rule_code ?? '—'}>
          <p className="text-[13px] leading-relaxed">
            {checks.find(c => c.status === 'failing')?.detail ?? 'No failing checks — all clear.'}
          </p>
          {checks.find(c => c.status === 'failing') && (
            <div className="mt-4 flex gap-2">
              <button className="h-8 border border-foreground bg-foreground px-3.5 text-[12px] text-background transition-colors hover:bg-transparent hover:text-foreground">
                Apply correction
              </button>
              <button className="h-8 border border-border px-3.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground">
                Show in plan
              </button>
            </div>
          )}
        </Panel>
        <Panel title="Approval track">
          <ol className="relative space-y-5 border-l border-border pl-5">
            {[
              ["Pre-scrutiny", "Cleared 04 Aug"],
              ["Plan sanction", "Submitted 11 Aug"],
              ["Structural NOC", "Pending — needs S-04 rev C"],
              ["Commencement", "Not started"],
            ].map(([t, s], i) => (
              <li key={t as string}>
                <span
                  className="absolute -left-[5px] mt-1.5 block h-2 w-2"
                  style={{ background: i < 2 ? "var(--moss)" : "var(--concrete)" }}
                />
                <p className="text-[13px]">{t}</p>
                <p className="label-tech mt-1">{s}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
