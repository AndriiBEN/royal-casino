"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Hand, Layers, Plus, RotateCcw, X } from "lucide-react";
import { actBlackjack, dealBlackjack } from "@/lib/actions/games";
import type { BlackjackView } from "@/lib/games/server/blackjack";
import type { Card } from "@/lib/games/cards";
import { Button } from "@/components/ui/Button";
import { cn, formatCredits } from "@/lib/utils";
import { useRound, type RoundState } from "./play/useRound";
import { PlayingCard } from "./play/PlayingCard";
import { Chip, ErrorLine, Hud, ResultBanner } from "./play/Hud";

const CHIP_VALUES = [10, 50, 100, 500, 2_500, 10_000, 50_000];

const OUTCOME_TEXT: Record<NonNullable<BlackjackView["outcome"]>, { title: string; tone: "win" | "loss" | "neutral" }> = {
  blackjack: { title: "Blackjack!", tone: "win" },
  win: { title: "You win", tone: "win" },
  push: { title: "Push", tone: "neutral" },
  lose: { title: "Dealer wins", tone: "loss" },
  bust: { title: "Bust", tone: "loss" },
  dealer_blackjack: { title: "Dealer blackjack", tone: "loss" },
};

function Total({ value, label }: { value: { total: number; soft: boolean } | null; label: string }) {
  if (!value) return <span className="rounded-full border border-line bg-ink/80 px-3 py-1 text-xs text-muted">{label} ?</span>;
  const bust = value.total > 21;
  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs font-bold tabular-nums", bust ? "border-ruby/50 bg-ruby/20 text-[#ff9aa2]" : "border-gold/50 bg-ink/80 text-gold-light")}>
      {label} {value.soft && value.total <= 21 ? `${value.total - 10}/${value.total}` : value.total}
    </span>
  );
}

/** Deal delays: cards already on the table stay put, new ones come in one after another. */
function useDealDelays(cards: (Card | null)[], key: string) {
  const seen = useRef<{ key: string; count: number }>({ key, count: 0 });
  const prev = seen.current.key === key ? seen.current.count : 0;
  useEffect(() => {
    seen.current = { key, count: cards.length };
  });
  return (i: number) => (i < prev ? 0 : (i - prev) * 0.32);
}

export function BlackjackTable({
  game,
  minBet,
  maxBet,
  initialBalance,
  active,
  rules,
}: {
  game: { id: string; name: string };
  minBet: number;
  maxBet: number;
  initialBalance: number;
  active: RoundState<BlackjackView> | null;
  rules: { blackjackPays: "3:2" | "6:5"; dealerHitsSoft17: boolean };
}) {
  const { round, balance, busy, error, setError, run, refreshShell } = useRound<BlackjackView>(active, initialBalance);
  // Chips from the table minimum up (smaller chips could never make a legal bet on their own).
  const chips = useMemo(() => {
    const fit = CHIP_VALUES.filter((c) => c >= minBet && c <= maxBet);
    return fit.length ? fit : [minBet];
  }, [minBet, maxBet]);
  const [chip, setChip] = useState(chips[0]);
  const [bet, setBet] = useState(Math.max(minBet, chip));
  const [lastBet, setLastBet] = useState<number | null>(null);
  const [handNo, setHandNo] = useState(0);

  const v = round?.view;
  const playing = v?.phase === "player";
  const settled = v?.phase === "settled";

  const dealerDelay = useDealDelays(v?.dealer ?? [], `${round?.roundId}`);
  const playerDelay = useDealDelays(v?.player ?? [], `${round?.roundId}`);

  useEffect(() => {
    if (settled) refreshShell();
  }, [settled, round?.roundId, refreshShell]);

  async function deal(amount = bet) {
    if (amount < minBet || amount > maxBet) return setError({ code: "limits", message: `Bets here are ${formatCredits(minBet)} to ${formatCredits(maxBet)} credits.` });
    const res = await run((requestId) => dealBlackjack({ gameId: game.id, bet: amount, requestId }));
    if (res?.ok) {
      setLastBet(amount);
      setHandNo((n) => n + 1);
    }
  }

  async function act(action: "hit" | "stand" | "double") {
    if (!round) return;
    await run((requestId) => actBlackjack({ roundId: round.roundId, version: round.version, action, requestId }));
  }

  const outcome = settled && v?.outcome ? OUTCOME_TEXT[v.outcome] : null;
  const net = settled && v ? v.returned - v.bet : 0;

  return (
    <div className="relative">
      {/* Felt */}
      <div className="relative overflow-hidden rounded-[2rem] border-gold-gradient p-4 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.95)] sm:p-8">
        {/* Felt on its own layer: the gradient-border utility owns the element's background. */}
        <div aria-hidden className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] bg-[radial-gradient(120%_90%_at_50%_0%,#145238,#0b2a1e_55%,#07140f)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-10 top-[46%] h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        <p aria-hidden className="pointer-events-none absolute inset-x-0 top-[47%] text-center font-display text-[0.7rem] uppercase tracking-[0.35em] text-gold/50 sm:text-xs">
          Blackjack pays {rules.blackjackPays.replace(":", " to ")} · Dealer {rules.dealerHitsSoft17 ? "hits soft 17" : "stands on 17"}
        </p>

        {/* Dealer */}
        <div className="relative flex min-h-[9.5rem] flex-col items-center gap-3 sm:min-h-[11rem]">
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-ivory/70">Dealer</span>
            {v && <Total value={v.dealerTotal} label="" />}
          </div>
          <div className="flex -space-x-8 sm:-space-x-6">
            {v?.dealer.map((c, i) => (
              <PlayingCard key={`${round?.roundId}-d${i}`} card={c} delay={dealerDelay(i)} from={{ x: 120, y: -40 }} />
            ))}
            {!v && <div className="h-[5.6rem] w-16 rounded-lg border border-dashed border-gold/25 sm:h-[6.6rem] sm:w-[4.7rem]" />}
          </div>
        </div>

        {/* Player */}
        <div className="relative mt-10 flex min-h-[9.5rem] flex-col items-center gap-3 sm:mt-14 sm:min-h-[11rem]">
          <div className="flex -space-x-8 sm:-space-x-6">
            {v?.player.map((c, i) => (
              <PlayingCard key={`${round?.roundId}-p${i}`} card={c} delay={playerDelay(i)} from={{ x: 120, y: -160 }} highlight={settled && OUTCOME_TEXT[v.outcome!]?.tone === "win"} />
            ))}
            {!v && <div className="h-[5.6rem] w-16 rounded-lg border border-dashed border-gold/25 sm:h-[6.6rem] sm:w-[4.7rem]" />}
          </div>
          <div className="flex items-center gap-2">
            {v && <Total value={v.playerTotal} label="You" />}
            {outcome && (
              <span className={cn("rounded-full px-3 py-1 text-xs font-bold", outcome.tone === "win" ? "bg-gold-gradient text-ink" : outcome.tone === "loss" ? "bg-ruby/25 text-[#ff9aa2]" : "bg-white/10 text-ivory")}>
                {outcome.title}
              </span>
            )}
            {v && (
              <span className="flex items-center gap-1.5 rounded-full border border-line bg-ink/70 px-3 py-1 text-xs text-muted">
                <Chip value={v.bet >= 100 ? v.bet : 10} size="sm" />
                <span className="font-bold tabular-nums text-ivory">{formatCredits(v.bet)}</span>
                {v.doubled && <span className="text-gold">doubled</span>}
              </span>
            )}
          </div>
        </div>

        <ResultBanner
          id={`${round?.roundId}-${handNo}`}
          show={!!outcome}
          title={outcome?.title ?? ""}
          amount={v && v.returned > 0 ? `+${formatCredits(v.returned)}` : undefined}
          sub={net > 0 ? `Net +${formatCredits(net)}` : net < 0 ? `Net −${formatCredits(-net)}` : "Stake returned"}
          tone={outcome?.tone}
        />
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {playing ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Button onClick={() => act("hit")} disabled={busy || !v.actions.includes("hit")} size="lg">
              <Plus className="h-4 w-4" /> Hit
            </Button>
            <Button onClick={() => act("stand")} disabled={busy || !v.actions.includes("stand")} size="lg" variant="outline">
              <Hand className="h-4 w-4" /> Stand
            </Button>
            <Button
              onClick={() => act("double")}
              disabled={busy || !v.actions.includes("double") || balance < v.bet}
              size="lg"
              variant="outline"
              title={balance < v.bet ? "Not enough credits to double" : undefined}
            >
              <Layers className="h-4 w-4" /> Double
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Chip value">
                {chips.map((c) => (
                  <Chip key={c} value={c} selected={c === chip} onClick={() => setChip(c)} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setBet((b) => Math.min(maxBet, b + chip))} disabled={busy} className="h-10 rounded-full border border-gold/50 px-4 text-sm font-semibold text-gold-light hover:bg-gold/10 disabled:opacity-40">
                  + {formatCredits(chip)}
                </button>
                <button type="button" onClick={() => setBet(minBet)} disabled={busy} aria-label="Reset bet" className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted hover:text-ivory disabled:opacity-40">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="mr-auto">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">Your bet</p>
                <motion.p key={bet} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-display text-3xl font-bold tabular-nums text-gold-gradient">
                  {formatCredits(bet)}
                </motion.p>
              </div>
              {lastBet !== null && lastBet !== bet && (
                <Button variant="outline" onClick={() => { setBet(lastBet); deal(lastBet); }} disabled={busy || lastBet > balance}>
                  <RotateCcw className="h-4 w-4" /> Rebet {formatCredits(lastBet)}
                </Button>
              )}
              <Button size="lg" onClick={() => deal()} disabled={busy || bet > balance || bet < minBet}>
                {settled ? "Deal again" : "Deal"}
              </Button>
            </div>
          </div>
        )}
        <ErrorLine error={error} />
        <Hud balance={balance} label="Last hand" value={settled ? `${net >= 0 ? "+" : "−"}${formatCredits(Math.abs(net))}` : "—"} tone={net > 0 ? "win" : net < 0 ? "loss" : "neutral"} />
      </div>
    </div>
  );
}
