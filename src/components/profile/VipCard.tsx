import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import type { VipTier } from "@prisma/client";
import { getTierProgress, tierStyle } from "@/lib/vip";
import { Progress } from "@/components/ui/Progress";
import { formatCredits, formatNumber } from "@/lib/utils";

/** Current tier, Crown Points and progress to the next tier. */
export function VipCard({ points, tiers, link = true }: { points: number; tiers: VipTier[]; link?: boolean }) {
  const t = getTierProgress(points, tiers);
  const style = tierStyle(t.current.level);
  const sorted = [...tiers].sort((a, b) => a.level - b.level);
  return (
    <div className="relative h-full overflow-hidden rounded-[1.5rem] border-gold-gradient p-6">
      <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-3xl" style={{ background: style.ring }} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.25em] text-subtle">VIP tier</p>
          <p className="font-display text-4xl font-bold" style={{ color: style.text }}>
            {t.current.name}
          </p>
          <p className="mt-1 text-xs text-muted">Daily bonus base {formatCredits(t.current.dailyBonus)}</p>
        </div>
        <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: `linear-gradient(145deg, ${style.from}, ${style.to})` }}>
          <Crown className="h-7 w-7 text-ink" />
        </span>
      </div>

      <div className="relative mt-6">
        <div className="mb-2 flex justify-between text-xs">
          <span className="tabular-nums text-ivory">
            <b>{formatNumber(points)}</b> <span className="text-muted">Crown Points</span>
          </span>
          <span className="text-gold-light">{t.next ? `${formatNumber(t.pointsToNext)} to ${t.next.name}` : "Top tier reached"}</span>
        </div>
        <Progress value={t.progress} label={`Progress to ${t.next?.name ?? "top tier"}`} />
        {/* tier ladder */}
        <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="VIP tiers">
          {sorted.map((tier) => {
            const s = tierStyle(tier.level);
            const reached = points >= tier.minPoints;
            return (
              <li key={tier.id} className="text-center">
                <span className="mx-auto block h-1.5 rounded-full" style={{ background: reached ? s.ring : "rgb(255 255 255 / 0.08)" }} />
                <span className="mt-1.5 block truncate text-[0.6rem] font-semibold uppercase tracking-[0.12em]" style={{ color: reached ? s.text : "#6b675e" }}>
                  {tier.name}
                </span>
                <span className="block text-[0.55rem] tabular-nums text-subtle">{tier.minPoints ? formatNumber(tier.minPoints) : "0"}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="relative mt-4 text-[0.7rem] text-subtle">1 Crown Point per virtual credit staked in any game. Simulated play only; points cannot be bought.</p>
      {link && (
        <Link href="/vip" className="relative mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-light">
          Tier benefits <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
