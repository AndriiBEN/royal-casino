import { describe, expect, it } from "vitest";
import {
  evaluate,
  FREE_SPINS_AWARD,
  jackpotContribution,
  jackpotHit,
  lineBetsFor,
  MAX_FREE_SPINS,
  nextFreeSpins,
  PAYLINES,
  PAYTABLE,
  REEL_WEIGHTS,
  SCATTER_PAY,
  type Grid,
  type SymbolId,
} from "@/lib/games/slots/engine";
import { simulateSlots } from "@/lib/games/slots/simulate";
import { seededRng } from "@/lib/games/rng";
import { scriptedRng } from "./support/rng";

/** Build a column-major grid from three visual rows (top, middle, bottom). */
function grid(top: SymbolId[], mid: SymbolId[], bot: SymbolId[]): Grid {
  return [0, 1, 2, 3, 4].map((r) => [top[r], mid[r], bot[r]]);
}
const FILL: SymbolId[] = ["club", "diamond", "heart", "spade", "star"];
const base = { lineBet: 10, lines: 20, freeSpin: false };

describe("slots: paylines", () => {
  it("defines 20 distinct paylines with a row per reel", () => {
    expect(PAYLINES).toHaveLength(20);
    expect(new Set(PAYLINES.map((l) => l.join())).size).toBe(20);
    for (const l of PAYLINES) expect(l.every((r) => r >= 0 && r <= 2)).toBe(true);
  });

  it("pays 3, 4 and 5 of a kind from the left on the middle line", () => {
    for (const count of [3, 4, 5]) {
      const mid = FILL.slice() as SymbolId[];
      for (let i = 0; i < count; i++) mid[i] = "crown";
      const r = evaluate(grid(["gem", "star", "gem", "star", "gem"], mid, ["heart", "club", "heart", "club", "heart"]), { ...base, lines: 1 });
      expect(r.lineWins).toEqual([{ line: 0, symbol: "crown", count, wild: false, multiplier: 1, payout: PAYTABLE.crown[count - 3] * 10 }]);
      expect(r.payout).toBe(PAYTABLE.crown[count - 3] * 10);
    }
  });

  it("does not pay matches that do not start on reel 1", () => {
    const r = evaluate(grid(FILL, ["club", "crown", "crown", "crown", "crown"], FILL), { ...base, lines: 1 });
    expect(r.payout).toBe(0);
  });

  it("only evaluates the active number of lines", () => {
    // Winning top row is line index 1: inactive with 1 line, active with 2.
    const g = grid(["gem", "gem", "gem", "club", "heart"], ["star", "club", "heart", "spade", "diamond"], ["heart", "spade", "club", "diamond", "star"]);
    expect(evaluate(g, { ...base, lines: 1 }).payout).toBe(0);
    expect(evaluate(g, { ...base, lines: 2 }).payout).toBe(PAYTABLE.gem[0] * 10);
  });

  it("rejects invalid parameters", () => {
    const g = grid(FILL, FILL, FILL);
    expect(() => evaluate(g, { lineBet: 0, lines: 1, freeSpin: false })).toThrow();
    expect(() => evaluate(g, { lineBet: 10, lines: 21, freeSpin: false })).toThrow();
    expect(() => evaluate(g, { lineBet: 1.5, lines: 1, freeSpin: false })).toThrow();
  });
});

describe("slots: wild and multipliers", () => {
  it("substitutes for line symbols and doubles the line win", () => {
    const r = evaluate(grid(FILL, ["star", "W", "star", "W", "club"], FILL), { ...base, lines: 1 });
    expect(r.lineWins[0]).toMatchObject({ symbol: "star", count: 4, wild: true, multiplier: 2, payout: PAYTABLE.star[1] * 10 * 2 });
  });

  it("never places a wild on reel 1", () => {
    expect(REEL_WEIGHTS[0].W).toBe(0);
  });

  it("does not let a wild stand in for a scatter", () => {
    const r = evaluate(grid(["S", "W", "S", "club", "heart"], FILL, FILL), base);
    expect(r.scatter.count).toBe(2);
    expect(r.scatter.freeSpins).toBe(0);
  });

  it("multiplies every free-spin win by 3, stacking with the wild x2", () => {
    const g = grid(FILL, ["gem", "W", "gem", "club", "heart"], FILL);
    const normal = evaluate(g, { ...base, lines: 1 });
    const free = evaluate(g, { ...base, lines: 1, freeSpin: true });
    expect(free.lineWins[0].multiplier).toBe(6);
    expect(free.payout).toBe(normal.payout * 3);
  });
});

describe("slots: scatter and bonus round", () => {
  it("pays scatters anywhere on the total bet and awards free spins", () => {
    for (const n of [3, 4, 5]) {
      const top = FILL.slice() as SymbolId[];
      for (let i = 0; i < n; i++) top[i] = "S";
      const r = evaluate(grid(top, ["club", "diamond", "club", "diamond", "club"], ["heart", "spade", "heart", "spade", "heart"]), { lineBet: 5, lines: 10, freeSpin: false });
      expect(r.scatter).toMatchObject({ count: n, payout: SCATTER_PAY[n - 3] * 50, freeSpins: FREE_SPINS_AWARD[n - 3] });
    }
  });

  it("counts free spins down, adds retriggers and caps the bank", () => {
    expect(nextFreeSpins(0, false, 8)).toBe(8);
    expect(nextFreeSpins(8, true, 0)).toBe(7);
    expect(nextFreeSpins(5, true, 12)).toBe(16);
    expect(nextFreeSpins(49, true, 20)).toBe(MAX_FREE_SPINS);
    expect(nextFreeSpins(1, true, 0)).toBe(0);
  });
});

describe("slots: progressive jackpot", () => {
  it("contributes 1% of the stake", () => {
    expect(jackpotContribution(1000)).toBe(10);
    expect(jackpotContribution(99)).toBe(0);
  });

  it("hits with probability contribution / pool", () => {
    // stake 10,000 -> contribution 100; pool 1,000 -> p = 0.1 -> threshold 100,000,000 of 1e9.
    expect(jackpotHit(scriptedRng([99_999_999]), 10_000, 1_000)).toBe(true);
    expect(jackpotHit(scriptedRng([100_000_000]), 10_000, 1_000)).toBe(false);
    expect(jackpotHit(scriptedRng([0]), 50, 1_000)).toBe(false); // contributes nothing, cannot win
  });
});

describe("slots: bet steps", () => {
  it("keeps the total bet inside the game's limits", () => {
    for (const lines of [1, 10, 20]) for (const b of lineBetsFor(20, 10_000, lines)) expect(b * lines).toBeGreaterThanOrEqual(20), expect(b * lines).toBeLessThanOrEqual(10_000);
  });
});

describe("slots: return to player", () => {
  it("lands between 94% and 97.5% over 400k simulated spins (free spins included)", () => {
    const s = simulateSlots(seededRng(2024), 400_000);
    expect(s.rtp).toBeGreaterThan(0.94);
    expect(s.rtp).toBeLessThan(0.975);
    expect(s.bonusRate).toBeGreaterThan(0.002);
    expect(s.bonusRate).toBeLessThan(0.008);
  });
});
