import { newDeck, type Card } from "../cards";
import { seededRng, type Rng } from "../rng";
import { bestHand } from "./evaluator";
import { activeSeats, applyMove, costOf, legalMoves, pot, type HoldemState, type Move, type Personality } from "./game";

/**
 * Local AI opponents.
 *
 * A bot only ever sees what a real player at its seat would see: its own two hole
 * cards, the community cards, the pot and the betting. `decide()` takes exactly those
 * inputs. The engine state (deck, other hole cards) is never passed in, so a bot
 * cannot cheat.
 *
 * Strength is estimated by Monte Carlo: the unseen cards are dealt at random to the
 * opponents still in the hand and to the rest of the board, many times over.
 */

export type BotView = {
  hole: Card[];
  community: Card[];
  opponents: number;
  pot: number;
  toCall: number;
  betSize: number;
  moves: Move[];
  personality: Personality;
};

export const BOT_ROSTER: { name: string; personality: Personality }[] = [
  { name: "Viktor", personality: { tight: 0.7, aggression: 0.35, bluff: 0.05 } },
  { name: "Isabella", personality: { tight: 0.35, aggression: 0.75, bluff: 0.25 } },
  { name: "Marcel", personality: { tight: 0.55, aggression: 0.5, bluff: 0.12 } },
  { name: "Sofia", personality: { tight: 0.25, aggression: 0.3, bluff: 0.08 } },
  { name: "Dmitri", personality: { tight: 0.8, aggression: 0.65, bluff: 0.15 } },
];

/** Share of the pot this hand wins on average against `opponents` random hands (ties split). */
export function estimateEquity(hole: Card[], community: Card[], opponents: number, iterations: number, rng: Rng) {
  const known = new Set<Card>([...hole, ...community]);
  const unseen = newDeck().filter((c) => !known.has(c));
  let total = 0;
  for (let it = 0; it < iterations; it++) {
    // Partial Fisher-Yates: draw just the cards this trial needs.
    const need = 5 - community.length + opponents * 2;
    const pool = unseen.slice();
    for (let i = 0; i < need; i++) {
      const j = i + rng.int(pool.length - i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const board = [...community, ...pool.slice(0, 5 - community.length)];
    const mine = bestHand([...hole, ...board]).score;
    let best = mine;
    let ties = 1;
    let lost = false;
    for (let o = 0; o < opponents; o++) {
      const off = 5 - community.length + o * 2;
      const theirs = bestHand([pool[off], pool[off + 1], ...board]).score;
      if (theirs > best) {
        lost = true;
        break;
      }
      if (theirs === best) ties++;
    }
    if (!lost) total += 1 / ties;
  }
  return total / iterations;
}

/**
 * Picks a legal move. `rng` drives the bot's own randomness (bluffs, mixing); a fast
 * PRNG seeded from it is used for the equity simulation.
 */
export function decide(v: BotView, rng: Rng, iterations = 220): Move {
  const { personality: p, moves } = v;
  const equity = estimateEquity(v.hole, v.community, Math.max(1, v.opponents), iterations, seededRng(rng.int(2 ** 31)));
  // Relative strength: 1.0 is an average hand against this many opponents.
  const rel = equity * (v.opponents + 1);
  const roll = rng.int(10_000) / 10_000;
  const canRaise = moves.includes("raise") || moves.includes("bet");
  const raiseMove: Move = moves.includes("bet") ? "bet" : "raise";

  if (v.toCall === 0) {
    if (canRaise && rel > 1.75 - p.aggression * 0.5) return raiseMove;
    if (canRaise && roll < p.bluff * 0.35) return raiseMove; // bluff / probe bet
    return "check";
  }

  const potOdds = v.toCall / (v.pot + v.toCall);
  if (canRaise && rel > 2.1 - p.aggression * 0.6 && roll > 0.15) return raiseMove;
  if (equity >= potOdds * (0.7 + p.tight * 0.6)) return "call";
  if (roll < p.bluff * 0.15) return "call"; // occasional float
  return "fold";
}

export function botViewFor(s: HoldemState, seat: number): BotView {
  const x = s.seats[seat];
  return {
    hole: x.hole,
    community: s.community,
    opponents: activeSeats(s).length - 1,
    pot: pot(s),
    toCall: costOf(s, "call", seat),
    betSize: costOf(s, "bet", seat) - costOf(s, "call", seat),
    moves: legalMoves(s, seat),
    personality: x.personality!,
  };
}

/** Lets bots act until it is the human's turn or the hand ends. */
export function runBots(s: HoldemState, rng: Rng, iterations?: number): HoldemState {
  let state = s;
  let guard = 0;
  while (!state.finished && state.toAct !== null && !state.seats[state.toAct].human) {
    if (guard++ > 200) throw new Error("Bot loop did not terminate");
    const move = decide(botViewFor(state, state.toAct), rng, iterations);
    state = applyMove(state, move);
  }
  return state;
}
