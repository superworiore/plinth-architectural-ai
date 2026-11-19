import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  meta,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col border border-border bg-card", className)}>
      {(title || actions) && (
        <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-4">
          <h2 className="label-tech !text-foreground">{title}</h2>
          {meta && <span className="label-tech truncate">{meta}</span>}
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={cn("min-w-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="p-4">
      <p className="label-tech">{label}</p>
      <p
        className={cn(
          "mt-3 text-xl font-light tracking-[-0.01em] tabular-nums",
          accent && "text-accent",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Bar({ value, tone = "ink" }: { value: number; tone?: "ink" | "oxide" | "steel" | "moss" }) {
  const bg = { ink: "var(--ink)", oxide: "var(--oxide)", steel: "var(--steel)", moss: "var(--moss)" }[tone];
  return (
    <div className="h-[3px] w-full bg-concrete/60">
      <div
        className="h-full transition-[width] duration-700"
        style={{ width: `${Math.round(Math.min(1, value) * 100)}%`, background: bg }}
      />
    </div>
  );
}

const toneMap: Record<string, string> = {
  ok: "text-moss border-moss/40",
  warn: "text-accent border-accent/40",
  fail: "text-destructive border-destructive/40",
  neutral: "text-muted-foreground border-border",
};

export function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof toneMap }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] uppercase",
        toneMap[tone],
      )}
    >
      {children}
    </span>
  );
}

export function ToolButton({
  children,
  active,
  onClick,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center gap-2 border px-2 text-[12px] transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function PageHeader({
  index,
  title,
  desc,
  actions,
}: {
  index: string;
  title: string;
  desc: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-5">
      <div>
        <span className="label-tech">{index}</span>
        <h1 className="mt-2 text-xl font-normal tracking-[-0.01em]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-muted-foreground">{desc}</p>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}
