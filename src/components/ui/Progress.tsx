import { cn } from "@/lib/utils";

export function Progress({ value, className, label }: { value: number; className?: string; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div
        className="h-full rounded-full bg-gold-gradient shadow-[0_0_12px_rgb(212_175_98/0.6)] transition-[width] duration-1000"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
