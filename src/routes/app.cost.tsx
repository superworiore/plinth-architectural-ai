import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, Metric, PageHeader, Panel } from "@/components/plinth/dashboard/ui";
import { useCosts, useCreateCostItem, useDeleteCostItem, useProjects } from "@/hooks/use-api";

export const Route = createFileRoute("/app/cost")({
  head: () => ({
    meta: [
      { title: "Cost & Materials — PLINTH" },
      { name: "description", content: "Live quantities, package budgets, variance and the project material specification." },
    ],
  }),
  component: Cost,
});

const inr = (n: number) =>
  "\u20B9" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

function Cost() {
  const { data: projectsData } = useProjects();
  const projectId = projectsData?.projects?.[0]?.id ?? "";
  const { data, isLoading } = useCosts(projectId);

  const createCostMutation = useCreateCostItem(projectId);
  const deleteCostMutation = useDeleteCostItem(projectId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [category, setCategory] = useState("Civil & Substructure");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState("sq ft");
  const [unitRate, setUnitRate] = useState(450);

  const items = data?.items ?? [];
  const summary = data?.summary;
  const budget = summary?.total_budget ?? 0;
  const estimated = summary?.total_estimated ?? 0;
  const variance = summary?.variance_percent ?? 0;
  const categories = summary?.by_category ?? [];
  const maxCat = Math.max(...categories.map((c) => c.total), 1);

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !projectId) return;

    try {
      await createCostMutation.mutateAsync({
        category,
        description,
        quantity: Number(quantity),
        unit,
        unit_rate: Number(unitRate),
      });
      toast.success(`Added "${description}" to BOQ Cost Model!`);
      setDescription("");
      setShowAddForm(false);
    } catch (err) {
      toast.error("Failed to add cost item. Please try again.");
    }
  }

  async function handleDeleteItem(costId: string, desc: string) {
    try {
      await deleteCostMutation.mutateAsync(costId);
      toast.info(`Deleted "${desc}" from BOQ Cost Model.`);
    } catch (err) {
      toast.error("Failed to delete cost item.");
    }
  }

  return (
    <div className="pb-8">
      <PageHeader
        index="06 — Cost & materials"
        title="Cost model"
        desc="Quantities are read from the model; rates are held per package. Variance updates whenever the drawing changes."
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground">Loading cost data...</div>
      ) : (
        <>
          <div className="grid gap-px border-b border-border bg-border sm:grid-cols-3">
            <div className="bg-card">
              <Metric label="Budget" value={inr(budget)} sub="Approved" />
            </div>
            <div className="bg-card">
              <Metric label="Current estimate" value={inr(estimated)} sub="Model-derived" />
            </div>
            <div className="bg-card">
              <Metric label="Variance" value={`${variance > 0 ? '+' : ''}${variance.toFixed(1)}%`} sub="Against approved budget" accent />
            </div>
          </div>

          <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1.1fr]">
            <Panel title="Packages" meta="By category" bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {categories.map((c) => (
                  <li key={c.category} className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px]">{c.category}</span>
                      <span className="font-mono text-[11px] tabular-nums">
                        {inr(c.total)}{" "}
                        <span className="text-muted-foreground">{c.percent}%</span>
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <Bar value={c.total / maxCat} tone="ink" />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel
              title="Line items"
              meta={`${items.length} items`}
              bodyClassName="p-0"
              actions={
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="h-7 border border-foreground bg-foreground px-3 text-[11px] text-background transition-colors hover:bg-transparent hover:text-foreground"
                >
                  {showAddForm ? "Close Form" : "+ Add Line Item"}
                </button>
              }
            >
              {showAddForm && (
                <form onSubmit={handleCreateItem} className="border-b border-border bg-sidebar/50 p-4 space-y-3">
                  <p className="label-tech font-semibold">New Cost Line Item</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label-tech mb-1 block">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="h-8 w-full border border-border bg-background px-2 text-[12px] outline-none"
                      >
                        <option value="Civil & Substructure">Civil & Substructure</option>
                        <option value="Finishes & Fitouts">Finishes & Fitouts</option>
                        <option value="MEP & HVAC">MEP & HVAC</option>
                        <option value="Millwork & Joinery">Millwork & Joinery</option>
                        <option value="Façade & Fenestration">Façade & Fenestration</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-tech mb-1 block">Description</label>
                      <input
                        type="text"
                        placeholder="e.g. Italian Marble Flooring"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        className="h-8 w-full border border-border bg-background px-2.5 text-[12px] outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label-tech mb-1 block">Quantity</label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        required
                        className="h-8 w-full border border-border bg-background px-2.5 font-mono text-[12px] outline-none"
                      />
                    </div>
                    <div>
                      <label className="label-tech mb-1 block">Unit</label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        required
                        className="h-8 w-full border border-border bg-background px-2.5 text-[12px] outline-none"
                      />
                    </div>
                    <div>
                      <label className="label-tech mb-1 block">Unit Rate (₹)</label>
                      <input
                        type="number"
                        value={unitRate}
                        onChange={(e) => setUnitRate(Number(e.target.value))}
                        required
                        className="h-8 w-full border border-border bg-background px-2.5 font-mono text-[12px] outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={createCostMutation.isPending}
                    className="h-8 w-full border border-foreground bg-foreground text-[11px] uppercase tracking-wider text-background transition-colors hover:bg-transparent hover:text-foreground disabled:opacity-50"
                  >
                    {createCostMutation.isPending ? "Saving..." : "Save Cost Item"}
                  </button>
                </form>
              )}

              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    {["Category", "Description", "Qty", "Rate", "Total", ""].map((h, i) => (
                      <th key={i} className="label-tech px-4 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-secondary">
                      <td className="px-4 py-2.5 text-[13px]">{m.category}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{m.description}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{m.quantity} {m.unit}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{inr(m.unit_rate)}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{inr(m.total)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteItem(m.id, m.description)}
                          title="Delete Cost Item"
                          className="text-[12px] opacity-60 transition-opacity hover:opacity-100 hover:text-destructive"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
