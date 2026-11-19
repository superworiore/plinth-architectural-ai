import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { PageHeader, Panel, Status } from "@/components/plinth/dashboard/ui";
import { useDocuments, useProjects, useUploadDocument } from "@/hooks/use-api";

export const Route = createFileRoute("/app/documents")({
  head: () => ({
    meta: [
      { title: "Documents — PLINTH" },
      { name: "description", content: "Drawing sets, schedules and the bill of quantities generated from the project model." },
    ],
  }),
  component: Documents,
});

function Documents() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: projectsData } = useProjects();
  const projectId = projectsData?.projects?.[0]?.id ?? "";
  const { data, isLoading } = useDocuments(projectId);
  const uploadDoc = useUploadDocument(projectId);
  const docs = data?.documents ?? [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    let docType = "other";
    const name = file.name.toLowerCase();
    if (name.includes("plan")) docType = "floor_plan";
    else if (name.includes("render") || name.endsWith(".jpg") || name.endsWith(".png")) docType = "render";
    else if (name.includes("elevation")) docType = "elevation";
    else if (name.includes("section")) docType = "section";
    else if (name.includes("boq") || name.includes("cost")) docType = "boq";
    else if (name.includes("report")) docType = "report";

    try {
      await uploadDoc.mutateAsync({ file, docType });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Upload error:", err);
    }
  }

  return (
    <div className="pb-8">
      <PageHeader
        index="09 — Documents"
        title="Drawing sets & Files"
        desc={`${docs.length} documents stored. Upload CAD files, PDFs, or rendering assets directly to your project cloud.`}
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp,.ifc,.zip"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadDoc.isPending || !projectId}
              className="h-8 border border-foreground bg-foreground px-3.5 text-[12px] text-background transition-colors hover:bg-transparent hover:text-foreground disabled:opacity-50"
            >
              {uploadDoc.isPending ? "Uploading..." : "Upload file"}
            </button>
          </div>
        }
      />

      <div className="p-4">
        <Panel bodyClassName="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground">Loading documents...</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  {["Type", "Title", "Version", "Date", "Action"].map((h) => (
                    <th key={h} className="label-tech px-4 py-2.5 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-secondary">
                    <td className="px-4 py-3 font-mono text-[11px] uppercase">{d.type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-[13px]">{d.title}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">v{d.version}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {d.file_url ? (
                        <a
                          href={`http://127.0.0.1:8000${d.file_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="border-b border-foreground/40 font-mono text-[11px] text-foreground hover:border-foreground"
                        >
                          View / Download
                        </a>
                      ) : (
                        <Status tone="ok">Issued</Status>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
