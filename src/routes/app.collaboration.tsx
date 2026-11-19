import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Status } from "@/components/plinth/dashboard/ui";
import { members, revisions, threads } from "@/lib/plinth-data";

export const Route = createFileRoute("/app/collaboration")({
  head: () => ({
    meta: [
      { title: "Collaboration — PLINTH" },
      { name: "description", content: "Comments, revisions, approvals and studio activity anchored to the drawings themselves." },
    ],
  }),
  component: Collaboration,
});

function Collaboration() {
  return (
    <div className="pb-8">
      <PageHeader
        index="08 — Collaboration"
        title="Review & approvals"
        desc="Every comment is anchored to a drawing, a level or an element. Revisions carry their author, their reason and their cost impact."
      />

      <div className="grid gap-4 p-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Threads" meta="3 active" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {threads.map((t) => (
              <li key={t.id} className="px-4 py-4 transition-colors hover:bg-secondary">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="label-tech">{t.id}</span>
                  <span className="text-[13px]">{t.on}</span>
                  <span className="ml-auto">
                    <Status tone={t.state === "Resolved" ? "ok" : t.state === "Blocked" ? "fail" : "warn"}>{t.state}</Status>
                  </span>
                </div>
                <p className="mt-3 max-w-2xl text-[13px] leading-relaxed">{t.body}</p>
                <p className="label-tech mt-3">
                  {t.author} · {t.time} ago · {t.replies} replies
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              placeholder="Comment on Level 01 · Living…"
              className="h-9 min-w-0 flex-1 border border-border bg-background px-3 text-[13px] outline-none focus:border-foreground/50"
            />
            <button className="h-9 border border-foreground bg-foreground px-4 text-[12px] text-background transition-colors hover:bg-transparent hover:text-foreground">
              Post
            </button>
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel title="Team" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.name} className="flex items-center gap-3 px-4 py-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center border border-border bg-secondary font-mono text-[10px]">
                    {m.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px]">{m.name}</span>
                    <span className="label-tech">{m.role}</span>
                  </span>
                  <span className="label-tech ml-auto truncate">{m.status}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Revisions" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {revisions.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="label-tech">{r.id}</span>
                    <Status tone={r.state === "Current" ? "warn" : r.state === "Approved" ? "ok" : "neutral"}>{r.state}</Status>
                  </div>
                  <p className="mt-1.5 text-[13px]">{r.label}</p>
                  <p className="label-tech mt-1">
                    {r.by} · {r.time}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
