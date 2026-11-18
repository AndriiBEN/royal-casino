import Link from "next/link";
import { Trophy } from "lucide-react";
import type { RecentWin } from "@/lib/queries";
import { GAME_ICONS, PALETTES } from "@/lib/constants";
import { LiveDot } from "@/components/ui/Badge";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { formatCredits } from "@/lib/utils";

function timeAgo(date: Date) {
  const s = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Winning rounds from the local database, newest first. */
export function RecentWinners({ wins }: { wins: RecentWin[] }) {
  if (!wins.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
        No wins yet. Be the first to land one.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5 sm:px-6">
        <p className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-muted">
          <LiveDot /> Latest wins
        </p>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-subtle">Virtual credits</p>
      </div>
      <RevealGroup className="divide-y divide-line" stagger={0.04}>
        {wins.map((w) => {
          if (!w.game) return null;
          const Icon = GAME_ICONS[w.game.icon] ?? Trophy;
          const p = PALETTES[w.game.palette] ?? PALETTES.obsidian;
          const big = (w.multiplier ?? 0) >= 10;
          return (
            <RevealItem key={w.id}>
              <Link
                href={`/games/${w.game.slug}`}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[auto_1fr_auto_auto] sm:px-6"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl ring-1 ring-gold/30"
                  style={{ background: `linear-gradient(150deg, ${p.via}, ${p.to})` }}
                >
                  <Icon className="h-5 w-5 text-gold-light" strokeWidth={1.6} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ivory">{w.wallet.user.displayName}</span>
                  <span className="block truncate text-xs text-muted group-hover:text-gold-light">
                    {w.game.name} · {timeAgo(w.createdAt)}
                  </span>
                </span>
                {w.multiplier != null && (
                  <span
                    className={
                      big
                        ? "hidden rounded-full bg-gold-gradient px-2.5 py-1 text-[0.65rem] font-bold text-ink sm:inline"
                        : "hidden rounded-full border border-line px-2.5 py-1 text-[0.65rem] font-bold text-muted sm:inline"
                    }
                  >
                    {w.multiplier.toFixed(1)}x
                  </span>
                )}
                <span className="text-right font-display text-xl font-bold tabular-nums text-gold-light">
                  +{formatCredits(w.amount)}
                </span>
              </Link>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </div>
  );
}
