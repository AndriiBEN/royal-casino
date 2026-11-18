import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border border-line bg-surface/80 p-4", className)}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-subtle">{label}</p>
        <p className="truncate font-display text-2xl font-semibold text-ivory">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
