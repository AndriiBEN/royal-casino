import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/games/cards";
import { bestHand, evaluate5 } from "@/lib/games/holdem/evaluator";
import { applyMove, costOf, legalMoves, newHand, pot, splitPot, viewOf, IllegalMove, type HoldemState, type SeatConfig } from "@/lib/games/holdem/game";
import { BOT_ROSTER, decide, estimateEquity, runBots } from "@/lib/games/holdem/ai";
import { seededRng } from "@/lib/games/rng";

const h = (s: string) => s.split(" ") as Card[];
const score = (s: string) => bestHand(h(s)).score;

describe("hold'em: hand evaluation", () => {
  it("ranks every category in order", () => {
    const hands = [
      "2s 5d 9h Jc Kd 3c 7h", // high card
      "2s 2d 9h Jc Kd 3c 7h", // pair
      "2s 2d 9h 9c Kd 3c 7h", // two pair
      "2s 2d 2h Jc Kd 3c 7h", // trips
      "4s 5d 6h 7c 8d Kc 2h", // straight
      "2s 5s 9s Js Ks 3c 7h", // flush
      "2s 2d 2h Jc Jd 3c 7h", // full house
      "2s 2d 2h 2c Kd 3c 7h", // quads
      "4s 5s 6s 7s 8s Kc 2h", // straight flush
    ];
    const names = hands.map((x) => bestHand(h(x)).name);
    expect(names).toEqual([
      "High card",
      "One pair",
      "Two pair",
      "Three of a kind",
      "Straight",
      "Flush",
      "Full house",
      "Four of a kind",
      "Straight flush",
    ]);
    for (let i = 1; i < hands.length; i++) expect(score(hands[i])).toBeGreaterThan(score(hands[i - 1]));
  });

  it("names a royal flush", () => {
    expect(bestHand(h("Ts Js Qs Ks As 2d 3c")).name).toBe("Royal flush");
  });

  it("treats A-2-3-4-5 as the lowest straight", () => {
    const wheel = bestHand(h("As 2d 3h 4c 5d Kc Kh"));
    expect(wheel.name).toBe("Straight");
    expect(score("As 2d 3h 4c 5d Kc Kh")).toBeLessThan(score("2s 3d 4h 5c 6d Kc Kh"));
    expect(score("Ts Jd Qh Kc Ad 2c 2h")).toBeGreaterThan(score("9s Td Jh Qc Kd 2c 2h"));
  });

  it("does not wrap straights around the ace", () => {
    expect(bestHand(h("Qs Kd Ah 2c 3d 8c 9h")).name).toBe("High card");
  });

  it("breaks ties with kickers", () => {
    expect(score("As Ad Kh 7c 4d 3c 2h")).toBeGreaterThan(score("As Ad Qh 7c 4d 3c 2h"));
    expect(score("Ks Kd 9h 9c Ad 3c 2h")).toBeGreaterThan(score("Ks Kd 9h 9c Qd 3c 2h"));
    expect(score("Ts Td Th 4c 4d 3c 2h")).toBeGreaterThan(score("9s 9d 9h Ac Ad 3c 2h")); // full house: trips first
    expect(score("As 9s 7s 4s 2s Kd Qh")).toBeGreaterThan(score("Ks Qs Js 9s 8s 2d 3h")); // flush: high card
  });

  it("finds exact ties (board plays)", () => {
    expect(score("2c 3d As Ks Qs Js Ts")).toBe(score("4h 5h As Ks Qs Js Ts"));
  });

  it("picks the best five of seven", () => {
    const r = bestHand(h("Ah Kh 2h 7h 9h 9c 9d"));
    expect(r.name).toBe("Flush");
    expect(r.best).toHaveLength(5);
    expect(evaluate5(h("Ah Kh 2h 7h 9h")).category).toBe(5);
  });
});

const seats = (n: number): SeatConfig[] => [
  { name: "You", human: true, personality: null },
  ...BOT_ROSTER.slice(0, n - 1).map((b) => ({ name: b.name, human: false, personality: b.personality })),
];

/** Deck that deals the given cards in order (hole cards one at a time from the left of the button, then board). */
const stack = (cards: string) => (h(cards).slice().reverse());

describe("hold'em: blinds, streets and betting", () => {
  it("posts blinds and starts action left of the big blind", () => {
    const s = newHand(seededRng(1), seats(4), 0, 100);
    expect(s.seats.map((x) => x.committed)).toEqual([0, 50, 100, 0]);
    expect(pot(s)).toBe(150);
    expect(s.toAct).toBe(3);
    expect(s.seats.every((x) => x.hole.length === 2)).toBe(true);
  });

  it("uses heads-up blind order (button posts the small blind and acts first)", () => {
    const s = newHand(seededRng(1), seats(2), 0, 100);
    expect(s.seats.map((x) => x.committed)).toEqual([50, 100]);
    expect(s.toAct).toBe(0);
  });

  it("deals flop, turn and river as betting rounds complete", () => {
    let s = newHand(seededRng(2), seats(3), 0, 100); // SB 1, BB 2, button 0 acts first
    s = applyMove(s, "call"); // seat 0
    s = applyMove(s, "call"); // seat 1 completes
    expect(s.street).toBe("preflop");
    expect(legalMoves(s)).toEqual(["check", "raise"]); // big blind option
    s = applyMove(s, "check");
    expect(s.street).toBe("flop");
    expect(s.community).toHaveLength(3);
    expect(s.toAct).toBe(1); // first active seat left of the button
    for (let i = 0; i < 3; i++) s = applyMove(s, "check");
    expect(s.street).toBe("turn");
    expect(s.community).toHaveLength(4);
    for (let i = 0; i < 3; i++) s = applyMove(s, "check");
    expect(s.street).toBe("river");
    for (let i = 0; i < 3; i++) s = applyMove(s, "check");
    expect(s.finished).toBe(true);
    expect(s.street).toBe("showdown");
    expect(s.winners.reduce((a, w) => a + w.amount, 0)).toBe(300);
  });

  it("uses small bets pre-flop/flop and big bets on turn/river, capped at 4 per street", () => {
    let s = newHand(seededRng(3), seats(2), 0, 100); // seat 0 SB to act
    expect(costOf(s, "raise")).toBe(150); // call 50 + raise 100
    s = applyMove(s, "raise"); // 2nd bet
    s = applyMove(s, "raise"); // 3rd
    s = applyMove(s, "raise"); // 4th = cap
    expect(legalMoves(s)).toEqual(["fold", "call"]);
    s = applyMove(s, "call");
    expect(pot(s)).toBe(800);
    expect(s.street).toBe("flop");
    s = applyMove(s, "check");
    s = applyMove(s, "check");
    expect(s.street).toBe("turn");
    expect(costOf(s, "bet")).toBe(200);
  });

  it("awards the pot when everyone else folds", () => {
    let s = newHand(seededRng(4), seats(3), 0, 100);
    s = applyMove(s, "raise"); // seat 0: 200 in
    s = applyMove(s, "fold"); // SB folds 50
    s = applyMove(s, "fold"); // BB folds 100
    expect(s.finished).toBe(true);
    expect(s.winners).toEqual([{ seat: 0, amount: 350, hand: null }]);
  });

  it("rejects illegal and out-of-turn moves", () => {
    const s = newHand(seededRng(5), seats(3), 0, 100);
    expect(() => applyMove(s, "check")).toThrow(IllegalMove); // facing the big blind
    expect(() => applyMove(s, "bet")).toThrow(IllegalMove);
    const done = applyMove(applyMove(s, "fold"), "fold");
    expect(() => applyMove(done, "call")).toThrow(IllegalMove);
  });
});

describe("hold'em: showdown and pot", () => {
  /** 3 seats, button 0: dealing starts at seat 1. Order: s1,s2,s0,s1,s2,s0, then flop(3), turn, river. */
  function play(cards: string) {
    let s: HoldemState = newHand(seededRng(1), seats(3), 0, 100, stack(cards));
    s = applyMove(s, "call");
    s = applyMove(s, "call");
    s = applyMove(s, "check");
    while (!s.finished) s = applyMove(s, "check");
    return s;
  }

  it("the best hand wins the whole pot", () => {
    // s1: As Ad, s2: Kc Kd, s0: 7h 2c; board Ah 9s 4d Jc 3h -> s1 trips aces.
    const s = play("As Kc 7h Ad Kd 2c Ah 9s 4d Jc 3h");
    expect(s.winners).toEqual([{ seat: 1, amount: 300, hand: "Three of a kind" }]);
  });

  it("splits a tied pot, odd cent first left of the button", () => {
    expect(splitPot(301, [1, 2], 0, 3)).toEqual([{ seat: 1, amount: 151 }, { seat: 2, amount: 150 }]);
    expect(splitPot(301, [0, 2], 1, 3)).toEqual([{ seat: 2, amount: 151 }, { seat: 0, amount: 150 }]);
    // Board royal flush: everyone ties.
    const s = play("2c 3d 4h 5c 6d 7h Ts Js Qs Ks As");
    expect(s.winners.map((w) => w.amount).sort()).toEqual([100, 100, 100]);
  });

  it("pot equals everything committed", () => {
    const s = play("As Kc 7h Ad Kd 2c Ah 9s 4d Jc 3h");
    expect(pot(s)).toBe(300);
    expect(s.winners.reduce((a, w) => a + w.amount, 0)).toBe(pot(s));
  });
});

describe("hold'em: client view", () => {
  it("never reveals the deck or opponents' cards before showdown", () => {
    const s = newHand(seededRng(6), seats(4), 0, 100);
    const v = viewOf(s, 0);
    expect(v.seats[0].hole.every(Boolean)).toBe(true);
    for (const x of v.seats.slice(1)) expect(x.hole).toEqual([null, null]);
    const json = JSON.stringify(v);
    for (const seat of s.seats.slice(1)) for (const c of seat.hole) expect(json).not.toContain(`"${c}"`);
    expect(v).not.toHaveProperty("deck");
  });
});

describe("hold'em: AI opponents", () => {
  it("estimates equity sensibly", () => {
    const rng = seededRng(11);
    expect(estimateEquity(h("As Ah"), [], 1, 3000, rng)).toBeGreaterThan(0.8);
    expect(estimateEquity(h("7c 2d"), [], 1, 3000, rng)).toBeLessThan(0.4);
    expect(estimateEquity(h("As Ks"), h("Qs Js Ts"), 3, 500, rng)).toBe(1); // made royal flush
  });

  it("always chooses a legal move and finishes hands", () => {
    const rng = seededRng(12);
    for (let hand = 0; hand < 40; hand++) {
      // All-bot table: replace the human with a bot so runBots plays everything.
      const cfg = seats(5).map((x, i) => (i === 0 ? { name: "Bot", human: false, personality: BOT_ROSTER[4].personality } : x));
      const s = runBots(newHand(rng, cfg, hand, 100), rng, 60);
      expect(s.finished).toBe(true);
      expect(s.winners.reduce((a, w) => a + w.amount, 0)).toBe(pot(s));
    }
  });

  it("folds trash facing a raise more often than premium hands", () => {
    const rng = seededRng(13);
    const view = (hole: string) => ({
      hole: h(hole),
      community: [],
      opponents: 3,
      pot: 450,
      toCall: 200,
      betSize: 100,
      moves: ["fold", "call", "raise"] as ("fold" | "call" | "raise")[],
      personality: BOT_ROSTER[0].personality,
    });
    let trashFolds = 0;
    let acesFolds = 0;
    for (let i = 0; i < 30; i++) {
      if (decide(view("7c 2d"), rng, 150) === "fold") trashFolds++;
      if (decide(view("As Ad"), rng, 150) === "fold") acesFolds++;
    }
    expect(acesFolds).toBe(0);
    expect(trashFolds).toBeGreaterThan(20);
  });
});
