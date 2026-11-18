import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENCIES, type CurrencyCode } from "@/lib/wallet/currencies";
import type { TxStatus } from "@/lib/wallet/limits";

/** Small "DEMO" tag placed on every wallet surface. */
export function DemoBadge({ className, label = "Demo" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "bg-demo-stripes inline-flex items-center gap-1 rounded-md border border-gold/50 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-gold-light",
        className,
      )}
    >
      <FlaskConical aria-hidden className="h-3 w-3" />
      {label}
    </span>
  );
}

/** Full-width banner at the top of every wallet page. */
export function DemoRibbon() {
  return (
    <div
      role="note"
      aria-label="Demo wallet notice"
      className="bg-demo-stripes flex flex-col gap-2 rounded-2xl border border-gold/50 px-5 py-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gold-gradient px-3 py-1 text-xs font-extrabold uppercase tracking-[0.24em] text-ink">
        <FlaskConical aria-hidden className="h-3.5 w-3.5" />
        Demo wallet
      </span>
      <p className="text-xs leading-relaxed text-ivory/90 sm:text-sm">
        Virtual credits only. Royal Casino never accepts, holds or pays out real money or real cryptocurrency.
        BTC, ETH and USDT figures are <b className="text-gold-light">simulated</b> at fixed demo rates.
      </p>
    </div>
  );
}

export function CoinGlyph({ code, size = "md" }: { code: CurrencyCode; size?: "sm" | "md" | "lg" }) {
  const c = CURRENCIES[code];
  const dims = { sm: "h-8 w-8 text-sm", md: "h-11 w-11 text-lg", lg: "h-14 w-14 text-2xl" }[size];
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-display font-bold ring-1", dims)}
      style={{ color: c.accent, background: `color-mix(in srgb, ${c.accent} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c.accent} 45%, transparent)` }}
    >
      {c.symbol}
    </span>
  );
}

const STATUS: Record<TxStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "border-gold/50 bg-gold/10 text-gold-light" },
  completed: { label: "Completed", cls: "border-jade/40 bg-jade/15 text-[#8ff0c2]" },
  failed: { label: "Failed", cls: "border-ruby/40 bg-ruby/15 text-[#ff9aa2]" },
  cancelled: { label: "Cancelled", cls: "border-line-strong bg-white/5 text-muted" },
  expired: { label: "Expired", cls: "border-line-strong bg-white/5 text-subtle" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status as TxStatus] ?? STATUS.completed;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em]", s.cls)}>
      {status === "pending" && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />}
      {s.label}
    </span>
  );
}
