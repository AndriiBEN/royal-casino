import { shuffledDeck, type Card } from "../cards";
import type { Rng } from "../rng";
import { bestHand, type HandRank } from "./evaluator";

/**
 * Texas Hold'em (fixed limit) against local AI opponents. Pure state machine.
 *
 * - Blinds: small blind = half the big blind. The button moves one seat each hand.
 * - Bet sizes: one "small bet" (= big blind) pre-flop and on the flop, one "big bet"
 *   (= 2 big blinds) on the turn and river. At most 4 bets per street (bet + 3 raises).
 * - Streets: pre-flop, flop (3 cards), turn (1), river (1), showdown.
 * - A hand ends when all but one player fold, or at showdown, where the best five-card
 *   hand from hole + community cards wins. Ties split the pot; any odd cent goes to the
 *   first tied winner left of the button.
 * - AI seats have house-funded stacks, so there are no all-ins or side pots. The human
 *   seat is funded from the wallet, which the server checks before every action.
 */

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
export type Move = "fold" | "check" | "call" | "bet" | "raise";

export type Personality = { tight: number; aggression: number; bluff: number };

export type Seat = {
  name: string;
  human: boolean;
  personality: Personality | null;
  hole: Card[];
  folded: boolean;
  /** total put into the pot this hand */
  committed: number;
  /** put in on the current street */
  streetBet: number;
  /** has acted since the last bet or raise */
  acted: boolean;
};

export type LogEntry = { seat: number; street: Street; move: Move | "small blind" | "big blind"; amount: number };

export type Winner = { seat: number; amount: number; hand: string | null };

export type HoldemState = {
  deck: Card[];
  seats: Seat[];
  button: number;
  bigBlind: number;
  community: Card[];
  street: Street;
  /** seat whose turn it is, null when the hand is over */
  toAct: number | null;
  /** highest streetBet on this street */
  currentBet: number;
  /** bets made this street (the big blind counts as the first pre-flop) */
  bets: number;
  log: LogEntry[];
  finished: boolean;
  winners: Winner[];
};

export const MAX_BETS_PER_STREET = 4;

export const pot = (s: HoldemState) => s.seats.reduce((a, x) => a + x.committed, 0);
export const betSize = (s: HoldemState) => (s.street === "preflop" || s.street === "flop" ? s.bigBlind : s.bigBlind * 2);
export const activeSeats = (s: HoldemState) => s.seats.map((x, i) => i).filter((i) => !s.seats[i].folded);
const nextSeat = (s: HoldemState, i: number) => (i + 1) % s.seats.length;

function nextActive(s: HoldemState, from: number) {
  let i = nextSeat(s, from);
  for (let k = 0; k < s.seats.length; k++, i = nextSeat(s, i)) if (!s.seats[i].folded) return i;
  return null;
}

export type SeatConfig = { name: string; human: boolean; personality: Personality | null };

export function newHand(rng: Rng, seats: SeatConfig[], button: number, bigBlind: number, deck?: Card[]): HoldemState {
  if (seats.length < 2 || seats.length > 6) throw new RangeError("2-6 seats");
  if (!Number.isSafeInteger(bigBlind) || bigBlind < 2 || bigBlind % 2) throw new RangeError("Big blind must be an even number of cents");
  const s: HoldemState = {
    deck: deck ? deck.slice() : shuffledDeck(rng),
    seats: seats.map((c) => ({ ...c, hole: [], folded: false, committed: 0, streetBet: 0, acted: false })),
    button: ((button % seats.length) + seats.length) % seats.length,
    bigBlind,
    community: [],
    street: "preflop",
    toAct: null,
    currentBet: 0,
    bets: 0,
    log: [],
    finished: false,
    winners: [],
  };
  // Two hole cards each, one at a time, starting left of the button.
  for (let round = 0; round < 2; round++) {
    for (let k = 1; k <= s.seats.length; k++) s.seats[(s.button + k) % s.seats.length].hole.push(s.deck.pop()!);
  }
  const heads = s.seats.length === 2;
  const sb = heads ? s.button : nextSeat(s, s.button);
  const bb = nextSeat(s, sb);
  post(s, sb, bigBlind / 2, "small blind");
  post(s, bb, bigBlind, "big blind");
  s.currentBet = bigBlind;
  s.bets = 1;
  s.toAct = nextSeat(s, bb);
  return s;
}

function post(s: HoldemState, seat: number, amount: number, move: LogEntry["move"]) {
  const x = s.seats[seat];
  x.committed += amount;
  x.streetBet += amount;
  s.log.push({ seat, street: s.street, move, amount });
}

/** Chips the seat must add to call. */
export const toCall = (s: HoldemState, seat: number) => s.currentBet - s.seats[seat].streetBet;

export function legalMoves(s: HoldemState, seat = s.toAct): Move[] {
  if (s.finished || seat === null || seat !== s.toAct) return [];
  const owe = toCall(s, seat);
  const canRaise = s.bets < MAX_BETS_PER_STREET;
  if (owe === 0) return canRaise ? ["check", s.currentBet === 0 ? "bet" : "raise"] : ["check"];
  return canRaise ? ["fold", "call", "raise"] : ["fold", "call"];
}

/** Chips a move adds to the pot for the seat to act. */
export function costOf(s: HoldemState, move: Move, seat = s.toAct!) {
  if (move === "call") return toCall(s, seat);
  if (move === "bet" || move === "raise") return toCall(s, seat) + betSize(s);
  return 0;
}

export class IllegalMove extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalMove";
  }
}

const clone = (s: HoldemState): HoldemState => ({
  ...s,
  deck: s.deck.slice(),
  seats: s.seats.map((x) => ({ ...x, hole: x.hole.slice() })),
  community: s.community.slice(),
  log: s.log.slice(),
  winners: s.winners.slice(),
});

/** Applies one move for the seat to act and advances streets/showdown as needed. */
export function applyMove(s0: HoldemState, move: Move): HoldemState {
  const seat = s0.toAct;
  if (seat === null || !legalMoves(s0, seat).includes(move)) throw new IllegalMove(`"${move}" is not allowed now`);
  const s = clone(s0);
  const x = s.seats[seat];
  const cost = costOf(s, move, seat);

  if (move === "fold") {
    x.folded = true;
    s.log.push({ seat, street: s.street, move, amount: 0 });
  } else {
    x.committed += cost;
    x.streetBet += cost;
    s.log.push({ seat, street: s.street, move, amount: cost });
    if (move === "bet" || move === "raise") {
      s.currentBet = x.streetBet;
      s.bets++;
      for (const o of s.seats) o.acted = false;
    }
  }
  x.acted = true;

  const live = activeSeats(s);
  if (live.length === 1) return finishByFold(s, live[0]);

  const roundDone = live.every((i) => s.seats[i].acted && s.seats[i].streetBet === s.currentBet);
  if (!roundDone) {
    s.toAct = nextActive(s, seat);
    return s;
  }
  return nextStreet(s);
}

function nextStreet(s: HoldemState): HoldemState {
  for (const o of s.seats) {
    o.streetBet = 0;
    o.acted = false;
  }
  s.currentBet = 0;
  s.bets = 0;
  const order: Street[] = ["preflop", "flop", "turn", "river", "showdown"];
  s.street = order[order.indexOf(s.street) + 1];
  if (s.street === "flop") s.community.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
  else if (s.street === "turn" || s.street === "river") s.community.push(s.deck.pop()!);
  else return showdown(s);
  s.toAct = nextActive(s, s.button);
  return s;
}

/** Splits `amount` between `winners`; odd cents go one at a time from the first winner left of the button. */
export function splitPot(amount: number, winners: number[], button: number, seatCount: number) {
  const ordered = winners.slice().sort((a, b) => ((a - button - 1 + seatCount) % seatCount) - ((b - button - 1 + seatCount) % seatCount));
  const share = Math.floor(amount / ordered.length);
  let rest = amount - share * ordered.length;
  return ordered.map((seat) => ({ seat, amount: share + (rest-- > 0 ? 1 : 0) }));
}

function showdown(s: HoldemState): HoldemState {
  const ranks = new Map<number, HandRank>();
  for (const i of activeSeats(s)) ranks.set(i, bestHand([...s.seats[i].hole, ...s.community]));
  const top = Math.max(...[...ranks.values()].map((r) => r.score));
  const winners = [...ranks.entries()].filter(([, r]) => r.score === top).map(([i]) => i);
  s.winners = splitPot(pot(s), winners, s.button, s.seats.length).map((w) => ({ ...w, hand: ranks.get(w.seat)!.name }));
  s.street = "showdown";
  s.toAct = null;
  s.finished = true;
  return s;
}

function finishByFold(s: HoldemState, winner: number): HoldemState {
  s.winners = [{ seat: winner, amount: pot(s), hand: null }];
  s.toAct = null;
  s.finished = true;
  return s;
}

/** Hand rank for each seat still in at showdown (for the client reveal). */
export function showdownHands(s: HoldemState) {
  if (!s.finished || s.street !== "showdown") return {};
  const out: Record<number, HandRank> = {};
  for (const i of activeSeats(s)) out[i] = bestHand([...s.seats[i].hole, ...s.community]);
  return out;
}

/* ------------------------------------------------------------------ */
/* Client view: never contains the deck or unrevealed hole cards        */
/* ------------------------------------------------------------------ */

export type HoldemView = {
  seats: {
    name: string;
    human: boolean;
    hole: (Card | null)[];
    folded: boolean;
    committed: number;
    streetBet: number;
    hand: string | null;
    best: Card[] | null;
  }[];
  button: number;
  bigBlind: number;
  community: Card[];
  street: Street;
  toAct: number | null;
  pot: number;
  toCall: number;
  betSize: number;
  moves: Move[];
  costs: Partial<Record<Move, number>>;
  log: LogEntry[];
  finished: boolean;
  winners: Winner[];
};

export function viewOf(s: HoldemState, humanSeat: number): HoldemView {
  const reveal = s.finished && s.street === "showdown";
  const hands = showdownHands(s);
  const moves = s.toAct === humanSeat ? legalMoves(s) : [];
  return {
    seats: s.seats.map((x, i) => {
      const visible = i === humanSeat || (reveal && !x.folded);
      return {
        name: x.name,
        human: x.human,
        hole: visible ? x.hole : x.hole.map(() => null),
        folded: x.folded,
        committed: x.committed,
        streetBet: x.streetBet,
        hand: hands[i]?.name ?? null,
        best: hands[i]?.best ?? null,
      };
    }),
    button: s.button,
    bigBlind: s.bigBlind,
    community: s.community,
    street: s.street,
    toAct: s.toAct,
    pot: pot(s),
    toCall: s.finished ? 0 : toCall(s, humanSeat),
    betSize: betSize(s),
    moves,
    costs: Object.fromEntries(moves.map((m) => [m, costOf(s, m, humanSeat)])),
    log: s.log,
    finished: s.finished,
    winners: s.winners,
  };
}
