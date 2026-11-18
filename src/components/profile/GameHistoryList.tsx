import Link from "next/link";
import { CircleDot, Club, Spade, Zap, type LucideIcon } from "lucide-react";
import type { HistoryEntry } from "@/lib/profile/stats";
import { cn, formatCredits } from "@/lib/utils";

const ENGINE_ICON: Record<string, LucideIcon> = { slots: Zap, blackjack: Spade, roulette: CircleDot, holdem: Club };
const timeFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Settled rounds with stake, return and net. All amounts are virtual credits. */
export function GameHistoryList({ rows }: { rows: HistoryEntry[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const Icon = ENGINE_ICON[r.engine] ?? Zap;
        const net = r.returned - r.staked;
        return (
          <li key={r.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl ring-1", net > 0 ? "bg-gold/10 text-gold-light ring-gold/30" : "bg-white/5 text-muted ring-line")}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`/games/${r.game.slug}`} className="truncate text-sm font-semibold text-ivory hover:text-gold-light">
                  {r.game.name}
                </Link>
                <span className="text-xs text-gold-light">{r.summary.label}</span>
              </span>
              <span className="block truncate text-xs text-muted">{r.summary.detail}</span>
              <span className="block text-[0.7rem] text-subtle">{timeFmt.format(r.createdAt)}</span>
            </span>
            <span className="text-right">
              <span className={cn("block font-bold tabular-nums", net > 0 ? "text-[#8ff0c2]" : net < 0 ? "text-ivory" : "text-muted")}>
                {net > 0 ? "+" : net < 0 ? "−" : "±"}
                {formatCredits(Math.abs(net))}
              </span>
              <span className="block text-[0.7rem] tabular-nums text-subtle">
                staked {formatCredits(r.staked)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
