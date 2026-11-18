import type { LucideIcon } from "lucide-react";
import { Eyebrow } from "./SectionHeader";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-line bg-surface px-6 py-10 sm:px-10 sm:py-12",
        className,
      )}
    >
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_120%_at_100%_0%,rgb(212_175_98/0.16),transparent_60%)]" />
      <div aria-hidden className="bg-pattern-deco absolute inset-0 opacity-40 [mask-image:linear-gradient(90deg,transparent,black)]" />
      {Icon && (
        <Icon aria-hidden className="absolute -right-6 -top-6 h-48 w-48 text-gold/[0.07]" strokeWidth={0.8} />
      )}
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-4 text-4xl text-ivory sm:text-5xl">{title}</h1>
          {description && <p className="mt-4 text-muted">{description}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}
