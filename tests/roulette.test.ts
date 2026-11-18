import { describe, expect, it } from "vitest";
import { betWins, colorOf, isValidBet, ODDS, RED, settle, spin, WHEEL_ORDER, type Bet, type BetKind } from "@/lib/games/roulette/engine";
import { seededRng } from "@/lib/games/rng";
import { scriptedRng } from "./support/rng";

describe("roulette: wheel", () => {
  it("has the 37 European pockets 0-36, each once", () => {
    expect(WHEEL_ORDER).toHaveLength(37);
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, i) => i));
  });

  it("has 18 red, 18 black and a green zero", () => {
    expect(RED.size).toBe(18);
    const colors = Array.from({ length: 37 }, (_, n) => colorOf(n));
    expect(colors.filter((c) => c === "black")).toHaveLength(18);
    expect(colorOf(0)).toBe("green");
    expect(colorOf(1)).toBe("red");
    expect(colorOf(2)).toBe("black");
    expect(colorOf(36)).toBe("red");
  });

  it("alternates red and black around the wheel", () => {
    for (let i = 1; i < 36; i++) expect(colorOf(WHEEL_ORDER[i])).not.toBe(colorOf(WHEEL_ORDER[i + 1]));
  });

  it("draws a pocket with the injected RNG", () => {
    expect(spin(scriptedRng([17]), []).number).toBe(17);
  });
});

describe("roulette: bets", () => {
  it("odd/even, low/high, dozens and columns", () => {
    expect(betWins({ kind: "odd", amount: 1 }, 7)).toBe(true);
    expect(betWins({ kind: "even", amount: 1 }, 7)).toBe(false);
    expect(betWins({ kind: "low", amount: 1 }, 18)).toBe(true);
    expect(betWins({ kind: "high", amount: 1 }, 19)).toBe(true);
    expect(betWins({ kind: "dozen", value: 2, amount: 1 }, 13)).toBe(true);
    expect(betWins({ kind: "dozen", value: 3, amount: 1 }, 24)).toBe(false);
    expect(betWins({ kind: "column", value: 1, amount: 1 }, 34)).toBe(true);
    expect(betWins({ kind: "column", value: 3, amount: 1 }, 36)).toBe(true);
  });

  it("zero loses every outside bet and wins only a straight on 0", () => {
    const outside: BetKind[] = ["red", "black", "odd", "even", "low", "high"];
    for (const k of outside) expect(betWins({ kind: k, amount: 1 }, 0)).toBe(false);
    expect(betWins({ kind: "dozen", value: 1, amount: 1 }, 0)).toBe(false);
    expect(betWins({ kind: "column", value: 1, amount: 1 }, 0)).toBe(false);
    expect(betWins({ kind: "straight", value: 0, amount: 1 }, 0)).toBe(true);
  });

  it("validates bet shapes", () => {
    expect(isValidBet({ kind: "straight", value: 36, amount: 100 })).toBe(true);
    expect(isValidBet({ kind: "straight", value: 37, amount: 100 })).toBe(false);
    expect(isValidBet({ kind: "dozen", value: 0, amount: 100 })).toBe(false);
    expect(isValidBet({ kind: "red", value: 3, amount: 100 })).toBe(false);
    expect(isValidBet({ kind: "red", amount: 0 })).toBe(false);
    expect(isValidBet({ kind: "red", amount: 1.5 })).toBe(false);
    expect(isValidBet({ kind: "split" as BetKind, amount: 100 })).toBe(false);
  });
});

describe("roulette: payouts", () => {
  it("returns stake x (odds + 1) for winners", () => {
    const bets: Bet[] = [
      { kind: "straight", value: 17, amount: 100 },
      { kind: "black", amount: 200 },
      { kind: "odd", amount: 300 },
      { kind: "dozen", value: 2, amount: 400 },
      { kind: "column", value: 2, amount: 500 },
      { kind: "red", amount: 600 },
      { kind: "high", amount: 700 },
    ];
    const r = settle(17, bets); // 17: black, odd, low, 2nd dozen, 2nd column
    expect(r.color).toBe("black");
    expect(r.staked).toBe(2800);
    expect(r.bets.map((b) => b.returned)).toEqual([3600, 400, 600, 1200, 1500, 0, 0]);
    expect(r.returned).toBe(3600 + 400 + 600 + 1200 + 1500);
  });

  it("every bet type has a 2.70% house edge", () => {
    const covered: Record<BetKind, number> = { straight: 1, red: 18, black: 18, odd: 18, even: 18, low: 18, high: 18, dozen: 12, column: 12 };
    for (const [kind, n] of Object.entries(covered) as [BetKind, number][]) {
      expect(((ODDS[kind] + 1) * n) / 37).toBeCloseTo(36 / 37, 10);
    }
  });

  it("exact RTP over all 37 pockets is 36/37 for a straight-up bet on every number", () => {
    const bets: Bet[] = Array.from({ length: 37 }, (_, n) => ({ kind: "straight", value: n, amount: 10 }));
    let returned = 0;
    for (let n = 0; n <= 36; n++) returned += settle(n, bets).returned;
    expect(returned / (370 * 37)).toBeCloseTo(36 / 37, 10);
  });

  it("the RNG is uniform enough over 370k spins", () => {
    const rng = seededRng(5);
    const counts = new Array(37).fill(0);
    for (let i = 0; i < 370_000; i++) counts[spin(rng, []).number]++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
  });
});
