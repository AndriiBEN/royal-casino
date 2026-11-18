import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PauseCircle, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { parseConfig } from "@/lib/games/config";
import { SlotMachine, SymbolIcon } from "@/components/games/SlotMachine";
import { BlackjackTable } from "@/components/games/BlackjackTable";
import { RouletteTable } from "@/components/games/RouletteTable";
import { HoldemTable } from "@/components/games/HoldemTable";
import { Badge } from "@/components/ui/Badge";
import { getGameBySlug } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { getCategory } from "@/lib/constants";
import { slugSchema } from "@/lib/validations";
import { FREE_SPINS_AWARD, FREE_SPIN_MULTIPLIER, MAX_LINES, PAYTABLE, SCATTER_PAY, WILD_MULTIPLIER, type PaySymbol } from "@/lib/games/slots/engine";
import { ODDS } from "@/lib/games/roulette/engine";
import { activeSlotsRound } from "@/lib/games/server/slots";
import { activeBlackjackRound } from "@/lib/games/server/blackjack";
import { activeHoldemRound } from "@/lib/games/server/holdem";
import { recentRouletteNumbers } from "@/lib/games/server/roulette";
import { formatCredits } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? getGameBySlug(parsed.data) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = await load((await params).slug);
  return { title: game ? `Play ${game.name}` : "Game not found" };
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 text-sm">
      <h2 className="text-2xl text-ivory">{title}</h2>
      <div className="mt-3 space-y-2 text-muted">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{k}</dt>
      <dd className="text-right tabular-nums text-ivory">{v}</dd>
    </div>
  );
}

const PAY_SYMBOLS = Object.keys(PAYTABLE) as PaySymbol[];

export default async function PlayPage({ params }: Props) {
  const { slug } = await params;
  const game = await load(slug);
  if (!game) notFound();
  const user = await requireUser(`/games/${game.slug}/play`);
  const balance = user.wallet?.balance ?? 0;
  const cat = getCategory(game.category);
  const machineGame = { id: game.id, name: game.name, icon: game.icon, palette: game.palette };
  const config = parseConfig("holdem", game.config);
  const bjRules = parseConfig("blackjack", game.config);
  const rouletteRules = parseConfig("roulette", game.config);
  // A disabled game cannot start new rounds; a player with an unfinished round may still complete it.
  const [activeSlots, activeBj, activeHoldem] = await Promise.all([
    game.engine === "slots" ? activeSlotsRound(user.id, game.id) : null,
    game.engine === "blackjack" ? activeBlackjackRound(user.id, game.id) : null,
    game.engine === "holdem" ? activeHoldemRound(user.id, game.id) : null,
  ]);
  if (!game.enabled && !activeSlots && !activeBj && !activeHoldem) {
    return (
      <div className="shell-container py-16">
        <EmptyState
          icon={PauseCircle}
          title={`${game.name} is temporarily unavailable`}
          description="The house has paused this game. Your balance is safe, and there are plenty of other tables open."
          action={<ButtonLink href="/games">Browse games</ButtonLink>}
        />
      </div>
    );
  }

  let table: React.ReactNode;
  let rules: React.ReactNode;

  switch (game.engine) {
    case "blackjack": {
      table = <BlackjackTable game={machineGame} minBet={game.minBet} maxBet={game.maxBet} initialBalance={balance} active={activeBj} rules={bjRules} />;
      rules = (
        <Panel title="Table rules">
          <ul className="list-disc space-y-1.5 pl-4">
            <li>Six decks, shuffled fresh for every hand.</li>
            <li>Dealer {bjRules.dealerHitsSoft17 ? "hits soft 17 and stands on hard 17" : "stands on all 17s"}, and peeks for blackjack with an Ace or ten showing.</li>
            <li>Blackjack pays {bjRules.blackjackPays.replace(":", " to ")}; other wins pay 1 to 1; ties push.</li>
            <li>Double down on any first two cards for exactly one more card.</li>
            <li>No split, insurance or surrender at this table.</li>
          </ul>
          <dl className="space-y-1.5 border-t border-line pt-3">
            <Row k="Bets" v={`${formatCredits(game.minBet)} – ${formatCredits(game.maxBet)}`} />
            <Row k="RTP (basic strategy)" v={`${game.rtp.toFixed(1)}%`} />
          </dl>
        </Panel>
      );
      break;
    }
    case "roulette": {
      table = <RouletteTable game={machineGame} minBet={game.minBet} maxBet={game.maxBet} initialBalance={balance} recent={await recentRouletteNumbers(user.id, game.id)} />;
      rules = (
        <Panel title="Payouts">
          <dl className="space-y-1.5">
            <Row k="Straight up (one number)" v={`${ODDS.straight} to 1`} />
            <Row k="Dozen · Column" v={`${ODDS.dozen} to 1`} />
            <Row k="Red/Black · Odd/Even · 1–18/19–36" v={`${ODDS.red} to 1`} />
          </dl>
          <p className="border-t border-line pt-3">
            Single zero. {rouletteRules.laPartage
              ? "La Partage: when zero hits, even-money bets return half their stake (98.65% RTP on those bets); other outside bets lose. Every other bet: 97.3%."
              : "Zero loses every outside bet. House edge 2.70% on every bet (RTP 97.3%)."}
          </p>
          <dl className="space-y-1.5">
            <Row k="Total bet per spin" v={`${formatCredits(game.minBet)} – ${formatCredits(game.maxBet)}`} />
          </dl>
        </Panel>
      );
      break;
    }
    case "holdem": {
      const bigBlind = game.minBet % 2 === 0 ? game.minBet : game.minBet + 1;
      table = <HoldemTable game={machineGame} bigBlind={bigBlind} initialBalance={balance} active={activeHoldem} />;
      rules = (
        <Panel title="How it plays">
          <ul className="list-disc space-y-1.5 pl-4">
            <li>You against {config.opponents} AI {config.opponents === 1 ? "opponent" : "opponents"}, each with its own style.</li>
            <li>Two hole cards each; five community cards over the flop, turn and river.</li>
            <li>Fixed limit: one small bet pre-flop and on the flop, one big bet on the turn and river, at most four bets per street.</li>
            <li>Best five-card hand wins at showdown. Ties split the pot.</li>
            <li>Your chips come from your wallet as you bet; the pot is paid to your wallet if you win. No rake.</li>
          </ul>
          <p className="border-t border-line pt-3 text-xs">The AI sees only its own cards and the board, exactly like a player in its seat.</p>
        </Panel>
      );
      break;
    }
    default: {
      table = <SlotMachine game={machineGame} minBet={game.minBet} maxBet={game.maxBet} initialBalance={balance} active={activeSlots} initialJackpot={game.jackpot} />;
      rules = (
        <>
          <Panel title="Paytable">
            <p className="text-xs">Left to right from reel 1, as a multiple of the line bet. Up to {MAX_LINES} paylines.</p>
            <table className="w-full">
              <thead>
                <tr className="text-[0.6rem] uppercase tracking-[0.2em] text-subtle">
                  <th className="pb-2 text-left font-bold">Symbol</th>
                  <th className="pb-2 text-right font-bold">x3</th>
                  <th className="pb-2 text-right font-bold">x4</th>
                  <th className="pb-2 text-right font-bold">x5</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {PAY_SYMBOLS.map((s) => (
                  <tr key={s}>
                    <td className="py-1">
                      <span className="flex items-center gap-2">
                        <SymbolIcon symbol={s} game={machineGame} className="h-8 w-8 rounded-lg" />
                        <span className="capitalize">{s}</span>
                      </span>
                    </td>
                    {PAYTABLE[s].map((v, i) => (
                      <td key={i} className="py-1 text-right font-semibold tabular-nums text-ivory">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Features">
            <div className="flex items-start gap-3">
              <SymbolIcon symbol="W" game={machineGame} className="h-10 w-10 shrink-0 rounded-lg" compact />
              <p>
                <b className="text-ivory">Wild</b> on reels 2–5 substitutes for every symbol except the scatter. Line wins with a wild pay <b className="text-gold-light">×{WILD_MULTIPLIER}</b>.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <SymbolIcon symbol="S" game={machineGame} className="h-10 w-10 shrink-0 rounded-lg" compact />
              <p>
                <b className="text-ivory">Scatter</b> pays anywhere: {SCATTER_PAY.join(" / ")}× the total bet for 3 / 4 / 5, and starts the bonus round.
              </p>
            </div>
            <p>
              <b className="text-ivory">Free spins:</b> {FREE_SPINS_AWARD.join(" / ")} spins for 3 / 4 / 5 scatters, at the triggering bet. Every win pays <b className="text-gold-light">×{FREE_SPIN_MULTIPLIER}</b> and scatters retrigger more spins.
            </p>
            {game.jackpot !== null && (
              <p>
                <b className="text-ivory">Progressive jackpot:</b> 1% of every paid stake feeds the pool. Any paid spin can win it; the chance grows with your stake.
              </p>
            )}
            <dl className="space-y-1.5 border-t border-line pt-3">
              <Row k="Total bet" v={`${formatCredits(game.minBet)} – ${formatCredits(game.maxBet)}`} />
              <Row k="RTP" v={`${game.rtp.toFixed(1)}%`} />
            </dl>
          </Panel>
        </>
      );
    }
  }

  return (
    <div className="shell-container py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/games/${game.slug}`} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted transition-colors hover:text-gold">
            <ChevronLeft className="h-4 w-4" />
            Game details
          </Link>
          <h1 className="mt-2 text-4xl text-ivory sm:text-5xl">{game.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {cat && <Badge tone="gold">{cat.label}</Badge>}
            <span className="text-xs text-muted">{game.studio}</span>
          </div>
        </div>
        <p className="flex max-w-sm items-center gap-2 text-xs text-subtle">
          <ShieldCheck className="h-4 w-4 shrink-0 text-gold" />
          Every outcome is decided on the server with a cryptographic RNG. Virtual credits only.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="mx-auto w-full min-w-0 max-w-4xl">{table}</div>
        <aside className="min-w-0 space-y-5">{rules}</aside>
      </div>
    </div>
  );
}
