import type { Promotion } from "@prisma/client";
import Link from "next/link";
import { CalendarClock, ChevronRight, Crown, Gift, RefreshCw, Sparkles, Sun, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, splitLines } from "@/lib/utils";

const KIND: Record<string, { icon: LucideIcon; label: string }> = {
  welcome: { icon: Gift, label: "Welcome" },
  weekly: { icon: RefreshCw, label: "Weekly" },
  daily: { icon: Sun, label: "Daily" },
  feature: { icon: Sparkles, label: "Slots feature" },
  jackpot: { icon: Trophy, label: "Jackpots" },
  tournament: { icon: Trophy, label: "Tournament" },
  vip: { icon: Crown, label: "VIP" },
};

/** Where each offer is used. */
const ACTION: Record<string, { href: string; label: string }> = {
  "welcome-credits": { href: "/register", label: "Create an account" },
  "daily-bonus": { href: "/wallet", label: "Claim in your wallet" },
  "free-spins": { href: "/games?category=slots", label: "Play slots" },
  "progressive-jackpots": { href: "/games?category=jackpots", label: "See jackpot slots" },
  "vip-club": { href: "/vip", label: "View the tiers" },
};

function timeLeft(endsAt: Date) {
  const ms = endsAt.getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

export function PromotionCard({
  promo,
  detailed = false,
  signedIn = false,
  className,
}: {
  promo: Promotion;
  detailed?: boolean;
  signedIn?: boolean;
  className?: string;
}) {
  const kind = KIND[promo.kind] ?? KIND.welcome;
  const action = signedIn && promo.slug === "welcome-credits" ? { href: "/wallet/history?type=signup", label: "See it in your history" } : ACTION[promo.slug];
  const Icon = kind.icon;

  return (
    <article
      id={promo.slug}
      className={cn(
        "group relative flex h-full scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300 hover:border-gold/40",
        className,
      )}
    >
      <div className="relative h-36 overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-[radial-gradient(90%_140%_at_100%_0%,rgb(212_175_98/0.35),transparent_60%),linear-gradient(160deg,#1b1b1d,#0b0b0d)]" />
        <div className="bg-pattern-deco absolute inset-0 opacity-70" />
        <Icon
          className="absolute -bottom-6 -right-4 h-36 w-36 text-gold/15 transition-transform duration-700 group-hover:-rotate-6 group-hover:scale-110"
          strokeWidth={1}
        />
        <div className="absolute left-5 top-5 flex gap-2">
          <Badge tone="solid">{kind.label}</Badge>
          {promo.endsAt && (
            <Badge tone="neutral" className="bg-ink/70 backdrop-blur">
              <CalendarClock className="h-3 w-3" />
              {timeLeft(promo.endsAt)}
            </Badge>
          )}
        </div>
        <p className="absolute bottom-4 left-5 right-16 font-display text-2xl font-bold leading-tight text-gold-gradient">
          {promo.reward}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-2xl text-ivory">{promo.title}</h3>
        <p className="mt-1 text-sm text-gold-light/80">{promo.subtitle}</p>
        {detailed && <p className="mt-4 text-sm leading-relaxed text-muted">{promo.description}</p>}

        {detailed && (
          <details className="group/terms mt-5 rounded-xl border border-line bg-ink/50 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-muted transition-colors hover:text-gold">
              Key terms
              <span className="text-gold transition-transform group-open/terms:rotate-45">+</span>
            </summary>
            <ul className="space-y-2 px-4 pb-4 text-xs text-muted">
              {splitLines(promo.terms).map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                  {t}
                </li>
              ))}
            </ul>
          </details>
        )}

        {detailed && action && (
          <Link
            href={action.href}
            className="mt-auto inline-flex items-center gap-1 self-start pt-5 text-sm font-semibold text-gold transition-colors hover:text-gold-light"
          >
            {action.label}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </article>
  );
}
