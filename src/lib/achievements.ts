/**
 * Achievement badges. Every badge is earned from simulated play recorded on the server
 * (settled game rounds, daily-bonus claims, VIP tier). Pure definitions: the server
 * evaluates them and stores the unlock date; the UI only renders the result.
 */

export type AchievementInput = {
  rounds: number;
  wins: number;
  /** best return / stake on a single round */
  bestMultiplier: number;
  /** distinct engines played */
  engines: string[];
  /** count of rounds carrying each summary tag */
  tags: Record<string, number>;
  longestWinStreak: number;
  bonusClaims: number;
  bonusStreak: number;
  tierLevel: number;
};

export type Rarity = "common" | "rare" | "epic" | "legendary";

export type Achievement = {
  code: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
  /** current value and target, for the progress hint on locked badges */
  progress: (s: AchievementInput) => [number, number];
};

const tag = (s: AchievementInput, t: string) => s.tags[t] ?? 0;

export const ACHIEVEMENTS: Achievement[] = [
  { code: "first_round", title: "First Hand", description: "Play your first round of any game.", icon: "play", rarity: "common", progress: (s) => [s.rounds, 1] },
  { code: "regular", title: "Regular", description: "Play 50 rounds.", icon: "repeat", rarity: "common", progress: (s) => [s.rounds, 50] },
  { code: "devotee", title: "House Devotee", description: "Play 500 rounds.", icon: "infinity", rarity: "rare", progress: (s) => [s.rounds, 500] },
  { code: "grand_tour", title: "Grand Tour", description: "Play slots, blackjack, roulette and hold'em.", icon: "compass", rarity: "common", progress: (s) => [s.engines.length, 4] },
  { code: "hot_streak", title: "Hot Streak", description: "Win 3 rounds in a row.", icon: "flame", rarity: "rare", progress: (s) => [s.longestWinStreak, 3] },
  { code: "big_win", title: "Big Win", description: "Win 10x your stake on a single round.", icon: "trending-up", rarity: "rare", progress: (s) => [Math.floor(s.bestMultiplier), 10] },
  { code: "royal_win", title: "Royal Win", description: "Win 50x your stake on a single round.", icon: "crown", rarity: "epic", progress: (s) => [Math.floor(s.bestMultiplier), 50] },
  { code: "free_spinner", title: "Free Spinner", description: "Trigger the slots free-spins bonus.", icon: "zap", rarity: "rare", progress: (s) => [tag(s, "free_spins"), 1] },
  { code: "jackpot", title: "Jackpot!", description: "Win a progressive jackpot.", icon: "gem", rarity: "legendary", progress: (s) => [tag(s, "jackpot"), 1] },
  { code: "natural", title: "Natural", description: "Be dealt a blackjack.", icon: "spade", rarity: "common", progress: (s) => [tag(s, "natural"), 1] },
  { code: "double_down", title: "Double Down", description: "Win a doubled blackjack hand.", icon: "layers", rarity: "common", progress: (s) => [tag(s, "doubled_win"), 1] },
  { code: "straight_up", title: "Straight Up", description: "Hit a single number in roulette.", icon: "target", rarity: "rare", progress: (s) => [tag(s, "straight_hit"), 1] },
  { code: "showdown", title: "Showdown King", description: "Win a hold'em pot at showdown.", icon: "trophy", rarity: "common", progress: (s) => [tag(s, "showdown_win"), 1] },
  { code: "monster", title: "Monster Hand", description: "Make a full house or better in hold'em.", icon: "sparkles", rarity: "epic", progress: (s) => [tag(s, "monster"), 1] },
  { code: "early_bird", title: "Early Bird", description: "Claim a daily demo bonus.", icon: "gift", rarity: "common", progress: (s) => [s.bonusClaims, 1] },
  { code: "loyal_week", title: "Loyal Week", description: "Claim the daily bonus 7 days in a row.", icon: "calendar-check", rarity: "epic", progress: (s) => [s.bonusStreak, 7] },
  { code: "silver_circle", title: "Silver Circle", description: "Reach Silver VIP.", icon: "medal", rarity: "common", progress: (s) => [Math.min(s.tierLevel, 2), 2] },
  { code: "gold_circle", title: "Gold Circle", description: "Reach Gold VIP.", icon: "medal", rarity: "rare", progress: (s) => [Math.min(s.tierLevel, 3), 3] },
  { code: "platinum_circle", title: "Platinum Circle", description: "Reach Platinum VIP.", icon: "medal", rarity: "epic", progress: (s) => [Math.min(s.tierLevel, 4), 4] },
  { code: "diamond_circle", title: "Diamond Circle", description: "Reach Diamond VIP.", icon: "gem", rarity: "legendary", progress: (s) => [Math.min(s.tierLevel, 5), 5] },
];

export const isEarned = (a: Achievement, s: AchievementInput) => {
  const [cur, target] = a.progress(s);
  return cur >= target;
};

export const RARITY_STYLE: Record<Rarity, { label: string; ring: string; text: string }> = {
  common: { label: "Common", ring: "#B89550", text: "#e8d8b0" },
  rare: { label: "Rare", ring: "#7fb8ff", text: "#cfe3ff" },
  epic: { label: "Epic", ring: "#c58bff", text: "#ead6ff" },
  legendary: { label: "Legendary", ring: "#f3d98f", text: "#fff1c4" },
};
