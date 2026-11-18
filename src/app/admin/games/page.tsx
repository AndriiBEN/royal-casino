import Link from "next/link";
import { Settings2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { adminMetadata } from "@/lib/admin/meta";
import { listGamesForAdmin } from "@/lib/admin/queries";
import { describeConfig } from "@/lib/games/config";
import { GameToggle } from "@/components/admin/GameForms";
import { Panel } from "@/components/admin/ui";
import { cn, formatCredits, formatNumber, formatRtp } from "@/lib/utils";

export const generateMetadata = () => adminMetadata("Games");

const ENGINE = { slots: "Slots", blackjack: "Blackjack", roulette: "Roulette", holdem: "Hold'em" } as Record<string, string>;

export default async function AdminGames() {
  await requireAdmin("/admin/games");
  const games = await listGamesForAdmin();
  const enabled = games.filter((g) => g.enabled).length;

  return (
    <Panel title="Games" description={`${enabled} of ${games.length} enabled. Observed RTP is what the last 30 days actually paid back; it converges on the published figure over many rounds.`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">
            <tr className="border-b border-line">
              <th className="px-5 py-3">Enabled</th>
              <th className="px-3 py-3">Game</th>
              <th className="px-3 py-3">Limits</th>
              <th className="px-3 py-3">Payout settings</th>
              <th className="px-3 py-3 text-right">Published RTP</th>
              <th className="px-3 py-3 text-right">Observed (30d)</th>
              <th className="px-3 py-3 text-right">Rounds (30d)</th>
              <th className="px-5 py-3 text-right">Configure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {games.map((g) => (
              <tr key={g.id} className={cn(!g.enabled && "opacity-60")}>
                <td className="px-5 py-3">
                  <GameToggle gameId={g.id} enabled={g.enabled} name={g.name} />
                </td>
                <td className="px-3 py-3">
                  <Link href={`/games/${g.slug}`} className="font-semibold text-ivory hover:text-gold-light">
                    {g.name}
                  </Link>
                  <span className="block text-xs text-muted">
                    {ENGINE[g.engine]} · {g.category}
                    {g.isFeatured ? " · featured" : ""}
                    {g.activeRounds ? ` · ${g.activeRounds} live round${g.activeRounds === 1 ? "" : "s"}` : ""}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted">
                  {formatCredits(g.minBet)} – {formatCredits(g.maxBet, { compact: true })}
                </td>
                <td className="px-3 py-3 text-xs text-muted">{describeConfig(g.engine, g.config)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ivory">{formatRtp(g.rtp)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-muted">{g.observedRtp !== null ? `${g.observedRtp.toFixed(1)}%` : "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ivory">{formatNumber(g.rounds30)}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/admin/games/${g.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-muted transition-colors hover:border-gold/50 hover:text-gold-light">
                    <Settings2 className="h-3.5 w-3.5" /> Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
