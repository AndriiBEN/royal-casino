import { shuffle, type Rng } from "./rng";

/** Card encoding: rank char + suit char, e.g. "As", "Td", "9h". Shared by blackjack and hold'em. */
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type Card = `${Rank}${Suit}`;

export const rankOf = (c: Card) => c[0] as Rank;
export const suitOf = (c: Card) => c[1] as Suit;
/** 2..14 (ace high). */
export const rankValue = (c: Card) => RANKS.indexOf(rankOf(c)) + 2;

export function newDeck(decks = 1): Card[] {
  const out: Card[] = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) out.push(`${r}${s}` as Card);
  return out;
}

export function shuffledDeck(rng: Rng, decks = 1): Card[] {
  return shuffle(newDeck(decks), rng);
}

export function isCard(v: unknown): v is Card {
  return typeof v === "string" && v.length === 2 && (RANKS as readonly string[]).includes(v[0]) && (SUITS as readonly string[]).includes(v[1]);
}
