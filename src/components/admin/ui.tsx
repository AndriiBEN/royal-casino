import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Card shell used across the admin console. */
export function Panel({ title, description, action, children, className }: { title?: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[1.25rem] border border-line bg-surface", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="text-xl text-ivory">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }>; tone?: "good" | "bad" }) {
  return (
    <div className="relative overflow-hidden rounded-[1.25rem] border border-line bg-surface p-5">
      <div aria-hidden className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold/10 blur-2xl" />
      <p className="relative flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-subtle">
        <Icon className="h-4 w-4 text-gold" /> {label}
      </p>
      <p className={cn("relative mt-2 font-display text-3xl font-bold tabular-nums", tone === "bad" ? "text-[#ff9aa2]" : tone === "good" ? "text-[#8ff0c2]" : "text-ivory")}>{value}</p>
      {hint && <p className="relative mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em]",
        status === "active" ? "border-jade/40 bg-jade/10 text-[#8ff0c2]" : "border-ruby/40 bg-ruby/15 text-[#ff9aa2]",
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", status === "active" ? "bg-[#8ff0c2]" : "bg-[#ff9aa2]")} />
      {status}
    </span>
  );
}

export function RolePill({ role }: { role: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em]", role === "ADMIN" ? "bg-gold-gradient text-ink" : "border border-line-strong text-muted")}>{role}</span>
  );
}

/** Filter chip that is a link (filters live in the URL, so views are shareable and back-button friendly). */
export function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors", active ? "border-gold bg-gold/15 text-gold-light" : "border-line text-muted hover:border-gold/40 hover:text-ivory")}
    >
      {children}
    </Link>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="inline-flex items-center gap-1 text-gold-light hover:underline">
          <ChevronLeft className="h-4 w-4" /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-subtle">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="inline-flex items-center gap-1 text-gold-light hover:underline">
          Next <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Builds a URL for a list page from current params plus overrides (empty values are dropped). */
export function urlWith(base: string, current: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v && !(k === "page" && v === "1")) q.set(k, v);
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}`;
}

export const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
export const dateTimeSec = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
