import { describe, expect, it } from "vitest";
import { act, deal, dealerShouldHit, handValue, isBlackjack, legalActions, payoutFor, viewOf, IllegalMove } from "@/lib/games/blackjack/engine";
import type { Card } from "@/lib/games/cards";
import { seededRng } from "@/lib/games/rng";

/**
 * Build a shoe so that cards are dealt in the given order.
 * Deal order: player, dealer up, player, dealer hole, then hits.
 */
const shoe = (...inOrder: Card[]) => inOrder.slice().reverse();
const rng = seededRng(1);

describe("blackjack: score calculation", () => {
  it("counts aces as 11 or 1", () => {
    expect(handValue(["As", "6d"])).toEqual({ total: 17, soft: true });
    expect(handValue(["As", "6d", "9c"])).toEqual({ total: 16, soft: false });
    expect(handValue(["As", "Ad"])).toEqual({ total: 12, soft: true });
    expect(handValue(["As", "Ad", "Ah", "Ac"])).toEqual({ total: 14, soft: true });
    expect(handValue(["Kh", "Qd", "5c"])).toEqual({ total: 25, soft: false });
  });

  it("recognises a natural only on the first two cards", () => {
    expect(isBlackjack(["As", "Kd"])).toBe(true);
    expect(isBlackjack(["7s", "7d", "7c"])).toBe(false);
  });
});

describe("blackjack: dealer rules", () => {
  it("hits 16 and stands on hard and soft 17 (S17)", () => {
    expect(dealerShouldHit(["Ts", "6d"])).toBe(true);
    expect(dealerShouldHit(["Ts", "7d"])).toBe(false);
    expect(dealerShouldHit(["As", "6d"])).toBe(false);
  });

  it("draws to 17 or more after the player stands", () => {
    const s = act(deal(rng, 100, shoe("Ts", "6h", "9d", "5c", "4s", "Kd")), "stand");
    // Dealer 6+5 = 11, draws 4 -> 15, draws K -> 25 bust.
    expect(s.dealer).toEqual(["6h", "5c", "4s", "Kd"]);
    expect(s.outcome).toBe("win");
  });

  it("stands on soft 17", () => {
    const s = act(deal(rng, 100, shoe("Ts", "As", "8d", "6c", "9h")), "stand");
    expect(s.dealer).toEqual(["As", "6c"]);
    expect(s.outcome).toBe("win"); // 18 vs 17
  });
});

describe("blackjack: rounds and results", () => {
  it("pays a player natural 3:2 immediately", () => {
    const s = deal(rng, 100, shoe("As", "9h", "Kd", "7c"));
    expect(s.phase).toBe("settled");
    expect(s.outcome).toBe("blackjack");
    expect(s.returned).toBe(250);
  });

  it("ends the round when the dealer peeks a natural", () => {
    const s = deal(rng, 100, shoe("Ts", "Ah", "9d", "Kc"));
    expect(s.outcome).toBe("dealer_blackjack");
    expect(s.returned).toBe(0);
  });

  it("pushes natural against natural", () => {
    const s = deal(rng, 100, shoe("As", "Ah", "Kd", "Qc"));
    expect(s.outcome).toBe("push");
    expect(s.returned).toBe(100);
  });

  it("busts on hit over 21 and loses only the stake", () => {
    let s = deal(rng, 100, shoe("Ts", "9h", "6d", "8c", "Kh"));
    s = act(s, "hit");
    expect(s.outcome).toBe("bust");
    expect(s.returned).toBe(0);
  });

  it("auto-stands on 21 after a hit", () => {
    let s = deal(rng, 100, shoe("Ts", "9h", "6d", "8c", "5h"));
    s = act(s, "hit");
    expect(handValue(s.player).total).toBe(21);
    expect(s.phase).toBe("settled");
    expect(s.outcome).toBe("win");
  });

  it("doubles the stake, deals exactly one card, then settles", () => {
    let s = deal(rng, 100, shoe("6s", "9h", "5d", "8c", "Th", "4c"));
    expect(legalActions(s)).toContain("double");
    s = act(s, "double");
    expect(s.player).toHaveLength(3);
    expect(s.bet).toBe(200);
    expect(s.outcome).toBe("win"); // 21 vs 17+4=21? dealer 9+8=17 stands
    expect(s.returned).toBe(400);
  });

  it("pushes equal totals and loses lower totals", () => {
    expect(act(deal(rng, 100, shoe("Ts", "Th", "8d", "8c")), "stand").outcome).toBe("push");
    expect(act(deal(rng, 100, shoe("Ts", "Th", "7d", "8c")), "stand").outcome).toBe("lose");
  });

  it("rejects illegal moves", () => {
    let s = deal(rng, 100, shoe("6s", "9h", "5d", "8c", "2h", "Kc"));
    s = act(s, "hit");
    expect(() => act(s, "double")).toThrow(IllegalMove); // double only on the first two cards
    const done = act(s, "stand");
    expect(() => act(done, "hit")).toThrow(IllegalMove);
  });

  it("payout table", () => {
    expect(payoutFor("blackjack", 101)).toBe(101 + 151); // 3:2 rounded down to the cent
    expect(payoutFor("win", 100)).toBe(200);
    expect(payoutFor("push", 100)).toBe(100);
    expect(payoutFor("lose", 100)).toBe(0);
    expect(payoutFor("bust", 100)).toBe(0);
    expect(payoutFor("dealer_blackjack", 100)).toBe(0);
  });
});

describe("blackjack: client view", () => {
  it("hides the hole card and the shoe while the player acts", () => {
    const s = deal(rng, 100, shoe("Ts", "9h", "6d", "8c", "Kh"));
    const v = viewOf(s);
    expect(v.dealer).toEqual(["9h", null]);
    expect(v.dealerTotal).toBeNull();
    expect(JSON.stringify(v)).not.toContain("8c");
    expect(v).not.toHaveProperty("shoe");
  });

  it("deals from a fresh 6-deck shoe of 312 cards", () => {
    const s = deal(seededRng(9), 100);
    expect(s.shoe.length + 4).toBe(312);
  });
});
