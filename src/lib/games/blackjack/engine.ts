import { rankOf, shuffledDeck, type Card } from "../cards";
import type { Rng } from "../rng";

/**
 * Blackjack: pure, server-side state machine.
 *
 * Table rules
 * - 6 decks, freshly shuffled for every round (no carry-over, so no card counting).
 * - Dealer stands on all 17s (S17).
 * - Blackjack pays 3:2. A natural beats a 21 made with three or more cards.
 * - Dealer peeks for blackjack when showing an Ace or ten-value card; a dealer natural
 *   ends the round at once (player natural pushes, anything else loses the bet only).
 * - Double down on any first two cards: the stake doubles and exactly one more card is dealt.
 * - No split, insurance or surrender at this table.
 *
 * Settlement amounts are "returns": what is paid back to the player, stake included.
 */

export const DECKS = 6;

export type Phase = "player" | "settled";
export type Outcome = "blackjack" | "win" | "push" | "lose" | "bust" | "dealer_blackjack";
export type Action = "hit" | "stand" | "double";

/** Table rules an admin can choose. Stored on each round so a hand in progress keeps its rules. */
export type BlackjackRules = { blackjackPays: "3:2" | "6:5"; dealerHitsSoft17: boolean };
export const DEFAULT_RULES: BlackjackRules = { blackjackPays: "3:2", dealerHitsSoft17: false };

export type BlackjackState = {
  rules?: BlackjackRules;
  shoe: Card[];
  player: Card[];
  dealer: Card[];
  bet: number;
  doubled: boolean;
  phase: Phase;
  outcome: Outcome | null;
  /** total paid back to the player when settled (stake included) */
  returned: number;
};

export function cardPoints(c: Card) {
  const r = rankOf(c);
  if (r === "A") return 11;
  if (r === "T" || r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}

/** Best total not over 21 if possible; `soft` when an ace still counts as 11. */
export function handValue(cards: Card[]) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardPoints(c);
    if (rankOf(c) === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21;

/** S17 (default): the dealer hits 16 or less and stands on every 17. H17 also hits soft 17. */
export function dealerShouldHit(cards: Card[], hitSoft17 = false) {
  const v = handValue(cards);
  return v.total < 17 || (hitSoft17 && v.total === 17 && v.soft);
}

function draw(s: BlackjackState): Card {
  const c = s.shoe.pop();
  if (!c) throw new Error("Shoe exhausted");
  return c;
}

export function legalActions(s: BlackjackState): Action[] {
  if (s.phase !== "player") return [];
  const acts: Action[] = ["hit", "stand"];
  if (s.player.length === 2 && !s.doubled) acts.push("double");
  return acts;
}

/** Deals a new round. `shoe` may be injected by tests; otherwise a fresh 6-deck shoe is shuffled. */
export function deal(rng: Rng, bet: number, shoe?: Card[], rules: BlackjackRules = DEFAULT_RULES): BlackjackState {
  if (!Number.isSafeInteger(bet) || bet <= 0) throw new RangeError("Invalid bet");
  const s: BlackjackState = {
    rules,
    shoe: shoe ? shoe.slice() : shuffledDeck(rng, DECKS),
    player: [],
    dealer: [],
    bet,
    doubled: false,
    phase: "player",
    outcome: null,
    returned: 0,
  };
  // Dealing order: player, dealer (up), player, dealer (hole). Cards are popped from the end.
  s.player.push(draw(s));
  s.dealer.push(draw(s));
  s.player.push(draw(s));
  s.dealer.push(draw(s));

  const playerBJ = isBlackjack(s.player);
  const up = cardPoints(s.dealer[0]);
  const dealerPeeks = up === 11 || up === 10;
  const dealerBJ = isBlackjack(s.dealer);

  if (dealerPeeks && dealerBJ) return settle(s, playerBJ ? "push" : "dealer_blackjack");
  if (playerBJ) return settle(s, dealerBJ ? "push" : "blackjack");
  return s;
}

/** Applies a player action. Throws on illegal moves; the caller validates before persisting. */
export function act(s0: BlackjackState, action: Action): BlackjackState {
  if (!legalActions(s0).includes(action)) throw new IllegalMove(`"${action}" is not allowed now`);
  const s: BlackjackState = { ...s0, shoe: s0.shoe.slice(), player: s0.player.slice(), dealer: s0.dealer.slice() };

  if (action === "hit") {
    s.player.push(draw(s));
    const v = handValue(s.player).total;
    if (v > 21) return settle(s, "bust");
    if (v === 21) return dealerPlays(s);
    return s;
  }
  if (action === "double") {
    s.doubled = true;
    s.bet *= 2;
    s.player.push(draw(s));
    if (handValue(s.player).total > 21) return settle(s, "bust");
    return dealerPlays(s);
  }
  return dealerPlays(s);
}

function dealerPlays(s: BlackjackState): BlackjackState {
  while (dealerShouldHit(s.dealer, s.rules?.dealerHitsSoft17)) s.dealer.push(draw(s));
  const p = handValue(s.player).total;
  const d = handValue(s.dealer).total;
  if (d > 21 || p > d) return settle(s, "win");
  if (p === d) return settle(s, "push");
  return settle(s, "lose");
}

/** Return (stake included) for an outcome. Blackjack 3:2 (or 6:5) is rounded down to the cent. */
export function payoutFor(outcome: Outcome, bet: number, rules: BlackjackRules = DEFAULT_RULES) {
  switch (outcome) {
    case "blackjack":
      return rules.blackjackPays === "6:5" ? bet + Math.floor((bet * 6) / 5) : bet + Math.floor((bet * 3) / 2);
    case "win":
      return bet * 2;
    case "push":
      return bet;
    default:
      return 0;
  }
}

function settle(s: BlackjackState, outcome: Outcome): BlackjackState {
  return { ...s, phase: "settled", outcome, returned: payoutFor(outcome, s.bet, s.rules ?? DEFAULT_RULES) };
}

export class IllegalMove extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalMove";
  }
}

/* ------------------------------------------------------------------ */
/* Client view: hides the shoe and the dealer's hole card               */
/* ------------------------------------------------------------------ */

export type BlackjackView = {
  player: Card[];
  dealer: (Card | null)[];
  playerTotal: { total: number; soft: boolean };
  dealerTotal: { total: number; soft: boolean } | null;
  bet: number;
  doubled: boolean;
  phase: Phase;
  outcome: Outcome | null;
  returned: number;
  actions: Action[];
};

export function viewOf(s: BlackjackState): BlackjackView {
  const hide = s.phase === "player";
  return {
    player: s.player,
    dealer: hide ? [s.dealer[0], null] : s.dealer,
    playerTotal: handValue(s.player),
    dealerTotal: hide ? null : handValue(s.dealer),
    bet: s.bet,
    doubled: s.doubled,
    phase: s.phase,
    outcome: s.outcome,
    returned: s.returned,
    actions: legalActions(s),
  };
}
