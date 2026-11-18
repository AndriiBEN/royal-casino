import { Trophy } from "lucide-react";
import type { RecentWin } from "@/lib/queries";
import { formatCredits } from "@/lib/utils";

/** Infinite marquee of the latest wins from the database. */
export function WinnersTicker({ wins }: { wins: RecentWin[] }) {
  if (!wins.length) return null;
  const loop = [...wins, ...wins];
  return (
    <div className="relative overflow-hidden rounded-full border border-line bg-surface/70 py-2.5 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div className="flex w-max animate-marquee gap-10 pr-10 hover:[animation-play-state:paused]">
        {loop.map((w, i) => (
          <p key={`${w.id}-${i}`} className="flex shrink-0 items-center gap-2 text-xs text-muted" aria-hidden={i >= wins.length}>
            <Trophy className="h-3.5 w-3.5 text-gold" />
            <span className="font-semibold text-ivory">{w.wallet.user.displayName}</span>
            won
            <span className="font-bold tabular-nums text-gold-light">{formatCredits(w.amount)}</span>
            on <span className="text-ivory/80">{w.game?.name}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
