import { cardPoints, handValue, type Action, type BlackjackState } from "./engine";

/**
 * Basic strategy for this table (6 decks, S17, double any two, no split/surrender).
 * Used by the RTP simulation and the seed's showcase players; never by the live game.
 */
export function basicStrategy(s: BlackjackState): Action {
  const { total, soft } = handValue(s.player);
  const up = cardPoints(s.dealer[0]); // 2..11
  const canDouble = s.player.length === 2;

  if (soft) {
    if (total >= 19) return total === 19 && up === 6 && canDouble ? "double" : "stand";
    if (total === 18) {
      if (up >= 3 && up <= 6 && canDouble) return "double";
      return up >= 9 ? "hit" : "stand";
    }
    if (total === 17) return up >= 3 && up <= 6 && canDouble ? "double" : "hit";
    if (total >= 15) return up >= 4 && up <= 6 && canDouble ? "double" : "hit";
    return up >= 5 && up <= 6 && canDouble ? "double" : "hit";
  }

  if (total >= 17) return "stand";
  if (total >= 13) return up <= 6 ? "stand" : "hit";
  if (total === 12) return up >= 4 && up <= 6 ? "stand" : "hit";
  if (total === 11) return canDouble ? "double" : "hit";
  if (total === 10) return up <= 9 && canDouble ? "double" : "hit";
  if (total === 9) return up >= 3 && up <= 6 && canDouble ? "double" : "hit";
  return "hit";
}
