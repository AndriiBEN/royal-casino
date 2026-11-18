import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-[0.7rem] font-bold uppercase tracking-[0.32em] text-gold",
        className,
      )}
    >
      <span aria-hidden className="h-px w-6 bg-gold/60" />
      {children}
    </p>
  );
}

export function SectionHeader({
  title,
  eyebrow,
  icon: Icon,
  href,
  hrefLabel = "View all",
  className,
  children,
}: {
  title: string;
  eyebrow?: string;
  icon?: LucideIcon;
  href?: string;
  hrefLabel?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h2 className="flex items-center gap-3 text-2xl text-ivory sm:text-3xl">
          {Icon && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
              <Icon className="h-4.5 w-4.5" />
            </span>
          )}
          <span className="truncate">{title}</span>
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {href && (
          <Link
            href={href}
            className="group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted transition-colors hover:text-gold"
          >
            {hrefLabel}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
