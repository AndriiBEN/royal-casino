"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Crown, User } from "lucide-react";
import { actHoldem, startHoldem } from "@/lib/actions/games";
import type { HoldemView } from "@/lib/games/server/holdem";
import type { Move } from "@/lib/games/holdem/game";
import { Button } from "@/components/ui/Button";
import { cn, formatCredits } from "@/lib/utils";
import { useRound, type RoundState } from "./play/useRound";
import { PlayingCard } from "./play/PlayingCard";
import { ErrorLine, Hud, ResultBanner } from "./play/Hud";
import { playSound } from "@/lib/sound";

/** Seat anchors (% of the table box) by player count. Seat 0 (you) is always bottom centre. */
const LAYOUT: Record<number, [number, number][]> = {
  2: [[50, 86], [50, 12]],
  3: [[50, 86], [14, 30], [86, 30]],
  4: [[50, 86], [9, 48], [50, 10], [91, 48]],
  5: [[50, 86], [9, 58], [24, 11], [76, 11], [91, 58]],
  6: [[50, 86], [8, 62], [15, 14], [50, 6], [85, 14], [92, 62]],
};

const STREET_LABEL = { preflop: "Pre-flop", flop: "Flop", turn: "Turn", river: "River", showdown: "Showdown" } as const;

const MOVE_LABEL: Record<string, string> = { fold: "Fold", check: "Check", call: "Call", bet: "Bet", raise: "Raise", "small blind": "Small blind", "big blind": "Big blind" };

function verb(move: string, amount: number) {
  if (move === "fold" || move === "check") return MOVE_LABEL[move];
  return `${MOVE_LABEL[move]} ${formatCredits(amount)}`;
}

export function HoldemTable({
  game,
  bigBlind,
  initialBalance,
  active,
}: {
  game: { id: string; name: string };
  bigBlind: number;
  initialBalance: number;
  active: RoundState<HoldemView> | null;
}) {
  const { round, balance, busy, error, run, refreshShell } = useRound<HoldemView>(active, initialBalance);
  const v = round?.view;
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (v?.finished) refreshShell();
  }, [v?.finished, round?.roundId, refreshShell]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [v?.log.length]);

  const start = () => run((requestId) => startHoldem({ gameId: game.id, requestId }));
  const move = (m: Move) => {
    if (m === "call" || m === "bet" || m === "raise") playSound("chip");
    return round && run((requestId) => actHoldem({ roundId: round.roundId, version: round.version, move: m, requestId }));
  };

  const lastAction = useMemo(() => {
    const out: Record<number, string> = {};
    if (!v) return out;
    for (const e of v.log) if (v.finished || e.street === v.street) out[e.seat] = verb(e.move, e.amount);
    return out;
  }, [v]);

  const winners = new Map((v?.winners ?? []).map((w) => [w.seat, w]));
  const myWin = v?.winners.filter((w) => w.seat === 0).reduce((a, w) => a + w.amount, 0) ?? 0;
  const myNet = v ? myWin - v.seats[0].committed : 0;
  const layout = LAYOUT[v?.seats.length ?? 4] ?? LAYOUT[4];
  const bestCards = new Set(v?.seats[0].best ?? []);
  const winnerBest = new Set(v?.winners.flatMap((w) => v.seats[w.seat].best ?? []) ?? []);

  return (
    <div className="space-y-4">
      <div className="relative pb-8 pt-4 sm:pb-6 sm:pt-2">
        <div className="relative mx-auto aspect-[4/3] w-full max-w-4xl sm:aspect-[16/10]">
          {/* Felt */}
          <div className="absolute inset-[8%_4%] rounded-[50%] border-[10px] border-[#3a2a14] bg-[radial-gradient(ellipse_at_50%_35%,#155a40,#0b2a1e_70%)] shadow-[inset_0_0_60px_rgb(0_0_0/0.8),0_30px_60px_-20px_rgb(0_0_0/0.9)] ring-2 ring-gold/50" />

          {/* Board */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-gold/70">{v ? STREET_LABEL[v.street] : "Texas Hold'em"}</p>
            <div className="flex gap-1 sm:gap-1.5">
              {Array.from({ length: 5 }).map((_, i) =>
                v?.community[i] ? (
                  <PlayingCard key={`${round?.roundId}-c${i}`} card={v.community[i]} size="sm" delay={i < 3 ? i * 0.12 : 0} highlight={v.finished && winnerBest.has(v.community[i])} />
                ) : (
                  <div key={i} className="h-[4.2rem] w-12 rounded-md border border-dashed border-gold/20" />
                ),
              )}
            </div>
            <motion.p key={v?.pot} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="rounded-full border border-gold/40 bg-ink/70 px-3 py-1 text-xs font-bold tabular-nums text-gold-light">
              Pot {formatCredits(v?.pot ?? 0)}
            </motion.p>
          </div>

          {/* Seats */}
          {(v?.seats ?? []).map((seat, i) => {
            const [x, y] = layout[i];
            const toAct = v!.toAct === i && !v!.finished;
            const win = winners.get(i);
            return (
              <div key={i} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${x}%`, top: `${y}%` }}>
                <div className={cn("flex gap-0.5", i === 0 ? "order-first" : "order-last")}>
                  {seat.hole.map((c, k) => (
                    <PlayingCard key={`${round?.roundId}-${i}-${k}-${c ?? "x"}`} card={c} size="sm" delay={k * 0.1 + i * 0.05} dim={seat.folded} highlight={!!win && !!c && (winnerBest.has(c) || bestCards.has(c))} />
                  ))}
                </div>
                <div
                  className={cn(
                    "relative flex min-w-24 items-center gap-2 rounded-full border bg-ink/90 py-1 pl-1 pr-3 shadow-lg transition-all",
                    toAct ? "border-gold shadow-[0_0_20px_rgb(212_175_98/0.6)]" : win ? "border-gold" : "border-line",
                    seat.folded && "opacity-50",
                  )}
                >
                  <span className={cn("grid h-7 w-7 place-items-center rounded-full", seat.human ? "bg-gold-gradient text-ink" : "bg-surface-3 text-gold")}>
                    {seat.human ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-xs font-semibold text-ivory">{seat.name}</span>
                    <span className="block truncate text-[0.6rem] text-muted">
                      {seat.folded ? "Folded" : seat.hand ?? (seat.committed ? `In ${formatCredits(seat.committed)}` : "")}
                    </span>
                  </span>
                  {v!.button === i && (
                    <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-ivory text-[0.55rem] font-extrabold text-ink shadow" title="Dealer button">
                      D
                    </span>
                  )}
                </div>
                <AnimatePresence mode="popLayout">
                  {win ? (
                    <motion.span key="win" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 rounded-full bg-gold-gradient px-2 py-0.5 text-[0.6rem] font-extrabold text-ink">
                      <Crown className="h-3 w-3" /> +{formatCredits(win.amount)}
                    </motion.span>
                  ) : lastAction[i] ? (
                    <motion.span key={lastAction[i]} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-full bg-black/60 px-2 py-0.5 text-[0.6rem] font-semibold text-gold-light">
                      {lastAction[i]}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}

          {!v && (
            <div className="absolute inset-0 grid place-items-center">
              <Button size="lg" onClick={start} disabled={busy}>
                Take a seat
              </Button>
            </div>
          )}

          <ResultBanner
            id={round?.roundId ?? "none"}
            show={!!v?.finished}
            title={myWin > 0 ? (v!.winners.length > 1 ? "Split pot" : "You win the pot") : v?.seats[0].folded ? "You folded" : "Pot lost"}
            amount={myWin > 0 ? `+${formatCredits(myWin)}` : undefined}
            sub={v?.finished ? (myWin > 0 ? (v.winners.find((w) => w.seat === 0)?.hand ?? "Everyone else folded") : `${v.winners.map((w) => v.seats[w.seat].name).join(" & ")} won${v.winners[0]?.hand ? ` with ${v.winners[0].hand.toLowerCase()}` : ""}`) : undefined}
            tone={myWin > 0 ? "win" : "loss"}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-3">
          {v && !v.finished && v.moves.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {(["fold", "check", "call", "bet", "raise"] as Move[])
                .filter((m) => v.moves.includes(m))
                .map((m) => {
                  const cost = v.costs[m] ?? 0;
                  return (
                    <Button key={m} size="lg" variant={m === "fold" ? "dark" : m === "raise" || m === "bet" ? "gold" : "outline"} onClick={() => move(m)} disabled={busy || cost > balance} title={cost > balance ? "Not enough credits" : undefined}>
                      {MOVE_LABEL[m]}
                      {cost > 0 && <span className="tabular-nums opacity-80">{formatCredits(cost)}</span>}
                    </Button>
                  );
                })}
            </div>
          ) : v && !v.finished ? (
            <p className="rounded-2xl border border-line bg-surface px-4 py-4 text-center text-sm text-muted">Waiting for the table…</p>
          ) : v?.finished ? (
            <Button size="lg" className="w-full" onClick={start} disabled={busy}>
              Deal next hand
            </Button>
          ) : null}
          <ErrorLine error={error} />
          <Hud
            balance={balance}
            label={v?.finished ? "This hand" : "In the pot"}
            value={v ? (v.finished ? `${myNet >= 0 ? "+" : "−"}${formatCredits(Math.abs(myNet))}` : formatCredits(v.seats[0].committed)) : "—"}
            tone={v?.finished ? (myNet > 0 ? "win" : myNet < 0 ? "loss" : "neutral") : "neutral"}
          />
          <p className="text-xs text-subtle">
            Fixed limit · blinds {formatCredits(bigBlind / 2)}/{formatCredits(bigBlind)} · bets {formatCredits(bigBlind)} pre-flop and flop, {formatCredits(bigBlind * 2)} turn and river · max 4 bets per street.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.25em] text-subtle">Action</p>
          <ol ref={logRef} className="max-h-48 space-y-1 overflow-y-auto pr-1 text-xs" aria-live="polite">
            {(v?.log ?? []).map((e, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * (i % 6) }} className="flex justify-between gap-2">
                <span className="truncate text-muted">
                  <span className={cn("font-semibold", e.seat === 0 ? "text-gold-light" : "text-ivory")}>{v!.seats[e.seat].name}</span> {verb(e.move, e.amount).toLowerCase()}
                </span>
                <span className="shrink-0 text-subtle">{STREET_LABEL[e.street]}</span>
              </motion.li>
            ))}
            {!v && <li className="text-subtle">Hands appear here as they are played.</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}
