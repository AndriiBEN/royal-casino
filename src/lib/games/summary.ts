import { handValue, type BlackjackState } from "./blackjack/engine";
import type { RouletteResult } from "./roulette/engine";
import { bestHand, CATEGORIES } from "./holdem/evaluator";
import type { HoldemState } from "./holdem/game";
import type { SpinEvaluation } from "./slots/engine";

/**
 * One-line, human-readable summary of a settled round, plus tags that achievements key on.
 * Pure: derived only from the stored engine state, so it can be recomputed at any time.
 */
export type RoundSummary = { label: string; detail: string; tags: string[] };

export type Tag =
  | "free_spins"
  | "jackpot"
  | "natural"
  | "doubled_win"
  | "straight_hit"
  | "showdown_win"
  | "monster"
  | "split_pot";

type SlotsState = { lines: number; freeSpinsPlayed: number; bonusWin: number; last: SpinEvaluation; jackpotWon: number | null };

const OUTCOME: Record<string, string> = {
  blackjack: "Blackjack",
  win: "Won",
  push: "Push",
  lose: "Lost",
  bust: "Bust",
  dealer_blackjack: "Dealer blackjack",
};

const STREET = { preflop: "pre-flop", flop: "the flop", turn: "the turn", river: "the river", showdown: "showdown" } as const;

export function summarize(engine: string, state: unknown): RoundSummary {
  switch (engine) {
    case "slots": {
      const s = state as SlotsState;
      const tags: Tag[] = [];
      if (s.freeSpinsPlayed > 0) tags.push("free_spins");
      if (s.jackpotWon) tags.push("jackpot");
      if (s.jackpotWon) return { label: "Progressive jackpot", detail: `${s.lines} lines`, tags };
      if (s.freeSpinsPlayed > 0) return { label: "Free spins bonus", detail: `${s.freeSpinsPlayed} free spins · ${s.lines} lines`, tags };
      const wins = s.last.lineWins.length;
      return { label: "Spin", detail: `${s.lines} ${s.lines === 1 ? "line" : "lines"} · ${wins ? `${wins} winning ${wins === 1 ? "line" : "lines"}` : "no win"}`, tags };
    }
    case "blackjack": {
      const s = state as BlackjackState;
      const tags: Tag[] = [];
      if (s.outcome === "blackjack") tags.push("natural");
      if (s.doubled && s.outcome === "win") tags.push("doubled_win");
      const p = handValue(s.player).total;
      const d = handValue(s.dealer).total;
      return { label: OUTCOME[s.outcome ?? "lose"] ?? "Settled", detail: `${p}${s.doubled ? " (doubled)" : ""} vs dealer ${d}`, tags };
    }
    case "roulette": {
      const r = state as RouletteResult;
      const tags: Tag[] = r.bets.some((b) => b.kind === "straight" && b.won) ? ["straight_hit"] : [];
      return { label: `${r.number} ${r.color}`, detail: `${r.bets.length} ${r.bets.length === 1 ? "bet" : "bets"}${tags.length ? " · straight up hit" : ""}`, tags };
    }
    case "holdem": {
      const s = state as HoldemState;
      const me = s.seats[0];
      const tags: Tag[] = [];
      if (me.folded) {
        const fold = s.log.find((e) => e.seat === 0 && e.move === "fold");
        return { label: "Folded", detail: `on ${STREET[fold?.street ?? "preflop"]}`, tags };
      }
      const mine = s.winners.filter((w) => w.seat === 0);
      const atShowdown = s.street === "showdown";
      const hand = atShowdown ? bestHand([...me.hole, ...s.community]) : null;
      if (hand && hand.category >= CATEGORIES.indexOf("Full house")) tags.push("monster");
      if (mine.length) {
        if (atShowdown) tags.push("showdown_win");
        if (s.winners.length > 1) tags.push("split_pot");
        return { label: s.winners.length > 1 ? "Split pot" : "Won the pot", detail: hand ? hand.name : "everyone else folded", tags };
      }
      const top = s.winners[0];
      return { label: "Lost", detail: `${s.seats[top.seat].name}${top.hand ? ` · ${top.hand.toLowerCase()}` : ""}`, tags };
    }
    default:
      return { label: "Round", detail: "", tags: [] };
  }
}
