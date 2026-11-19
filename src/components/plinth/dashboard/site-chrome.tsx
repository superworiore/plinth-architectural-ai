import { cn } from "@/lib/utils";

export function Wordmark({ className, mark = "PLINTH" }: { className?: string; mark?: string }) {
  return (
    <span
      className={cn("inline-block whitespace-nowrap font-semibold uppercase leading-none", className)}
      style={{ letterSpacing: "0.18em", fontFeatureSettings: '"ss01"' }}
    >
      {mark}
    </span>
  );
}
