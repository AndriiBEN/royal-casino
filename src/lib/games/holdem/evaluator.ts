import { rankValue, suitOf, type Card } from "../cards";

/**
 * Poker hand evaluator. Scores are numbers that compare directly: higher wins, equal ties.
 * score = category * 15^5 + tiebreak ranks packed base-15 (most significant first).
 */

export const CATEGORIES = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type HandRank = { score: number; category: number; name: string; best: Card[] };

const pack = (category: number, ranks: number[]) => {
  let s = category;
  for (let i = 0; i < 5; i++) s = s * 15 + (ranks[i] ?? 0);
  return s;
};

/** Highest card of a straight in these distinct descending ranks, or 0. Handles the A-2-3-4-5 wheel. */
function straightHigh(desc: number[]) {
  const set = new Set(desc);
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true;
    for (let k = 0; k < 5; k++) {
      const r = hi - k === 1 ? 14 : hi - k; // rank 1 means the ace in a wheel
      if (!set.has(r)) {
        ok = false;
        break;
      }
    }
    if (ok) return hi;
  }
  return 0;
}

/** Evaluates exactly five cards. */
export function evaluate5(cards: Card[]): { score: number; category: number } {
  if (cards.length !== 5) throw new RangeError("evaluate5 needs 5 cards");
  const ranks = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const distinct = [...new Set(ranks)];
  const sh = distinct.length === 5 ? straightHigh(distinct) : 0;

  if (flush && sh) return { score: pack(8, [sh]), category: 8 };

  // Group by count, then rank: e.g. full house [3-of rank, 2-of rank].
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const order = groups.map((g) => g[0]);
  const shape = groups.map((g) => g[1]).join("");

  if (shape === "41") return { score: pack(7, order), category: 7 };
  if (shape === "32") return { score: pack(6, order), category: 6 };
  if (flush) return { score: pack(5, ranks), category: 5 };
  if (sh) return { score: pack(4, [sh]), category: 4 };
  if (shape === "311") return { score: pack(3, order), category: 3 };
  if (shape === "221") return { score: pack(2, order), category: 2 };
  if (shape === "2111") return { score: pack(1, order), category: 1 };
  return { score: pack(0, ranks), category: 0 };
}

/** Best five-card hand from 5 to 7 cards (checks every 5-card combination). */
export function bestHand(cards: Card[]): HandRank {
  if (cards.length < 5 || cards.length > 7) throw new RangeError("bestHand needs 5-7 cards");
  let best: HandRank | null = null;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const r = evaluate5(five);
            if (!best || r.score > best.score) best = { ...r, name: CATEGORIES[r.category], best: five };
          }
  if (best!.category === 8 && best!.best.map(rankValue).includes(14) && best!.best.map(rankValue).includes(13)) {
    best!.name = "Royal flush";
  }
  return best!;
}
