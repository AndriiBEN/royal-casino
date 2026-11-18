import type { Rng } from "../rng";

/**
 * European roulette: single zero, 37 pockets. Pure engine.
 * A bet's return (stake included) is stake x (odds + 1) when it wins; 0 loses every
 * outside bet. House edge 1/37 ≈ 2.70% on every bet type (RTP 97.30%).
 */

/** Pocket order clockwise around a European wheel, starting at 0. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type Color = "red" | "black" | "green";
export const colorOf = (n: number): Color => (n === 0 ? "green" : RED.has(n) ? "red" : "black");

export type BetKind = "straight" | "red" | "black" | "odd" | "even" | "low" | "high" | "dozen" | "column";

/** Payout odds (x to 1). */
export const ODDS: Record<BetKind, number> = {
  straight: 35,
  red: 1,
  black: 1,
  odd: 1,
  even: 1,
  low: 1,
  high: 1,
  dozen: 2,
  column: 2,
};

/** `value` is the number for straight bets and 1-3 for dozens/columns; unused otherwise. */
export type Bet = { kind: BetKind; value?: number; amount: number };

export function isValidBet(b: Bet) {
  if (!Number.isSafeInteger(b.amount) || b.amount <= 0) return false;
  if (!(b.kind in ODDS)) return false;
  if (b.kind === "straight") return Number.isInteger(b.value) && b.value! >= 0 && b.value! <= 36;
  if (b.kind === "dozen" || b.kind === "column") return Number.isInteger(b.value) && b.value! >= 1 && b.value! <= 3;
  return b.value === undefined;
}

export function betWins(b: Bet, n: number): boolean {
  switch (b.kind) {
    case "straight":
      return n === b.value;
    case "red":
      return colorOf(n) === "red";
    case "black":
      return colorOf(n) === "black";
    case "odd":
      return n !== 0 && n % 2 === 1;
    case "even":
      return n !== 0 && n % 2 === 0;
    case "low":
      return n >= 1 && n <= 18;
    case "high":
      return n >= 19 && n <= 36;
    case "dozen":
      return n !== 0 && Math.ceil(n / 12) === b.value;
    case "column":
      return n !== 0 && ((n - 1) % 3) + 1 === b.value;
  }
}

/** Canonical key so identical bets merge on the table, e.g. "straight:17", "red", "dozen:2". */
export const betKey = (b: Pick<Bet, "kind" | "value">) => (b.value === undefined ? b.kind : `${b.kind}:${b.value}`);

export type SettledBet = Bet & { won: boolean; returned: number };
export type RouletteResult = { number: number; color: Color; bets: SettledBet[]; staked: number; returned: number };

const EVEN_MONEY = new Set<BetKind>(["red", "black", "odd", "even", "low", "high"]);

/** Table options. La Partage: when 0 hits, even-money bets get half their stake back. */
export type RouletteRules = { laPartage: boolean };

export function settle(n: number, bets: Bet[], rules: RouletteRules = { laPartage: false }): RouletteResult {
  if (!Number.isInteger(n) || n < 0 || n > 36) throw new RangeError("Invalid pocket");
  const settled = bets.map((b) => {
    const won = betWins(b, n);
    const half = !won && n === 0 && rules.laPartage && EVEN_MONEY.has(b.kind) ? Math.floor(b.amount / 2) : 0;
    return { ...b, won, returned: won ? b.amount * (ODDS[b.kind] + 1) : half };
  });
  return {
    number: n,
    color: colorOf(n),
    bets: settled,
    staked: bets.reduce((a, b) => a + b.amount, 0),
    returned: settled.reduce((a, b) => a + b.returned, 0),
  };
}

/** One spin: a uniform pocket from the CSPRNG. */
export function spin(rng: Rng, bets: Bet[], rules?: RouletteRules): RouletteResult {
  return settle(rng.int(37), bets, rules);
}
