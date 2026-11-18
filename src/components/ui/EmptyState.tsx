import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-pattern-deco flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center",
        className,
      )}
    >
      <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="text-2xl text-ivory">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
