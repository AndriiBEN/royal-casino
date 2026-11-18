import {
  Bomb,
  Cherry,
  Club,
  Crown,
  Dice5,
  Disc3,
  Eye,
  FerrisWheel,
  Flame,
  Flower2,
  Gem,
  Layers,
  Pyramid,
  Rocket,
  Spade,
  Sparkles,
  Ticket,
  Timer,
  Triangle,
  Trophy,
  Tv,
  Vault,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const SITE = {
  name: "Royal Casino",
  tagline: "The house of gold",
  description:
    "Royal Casino is a premium play-money casino lobby with slots, live tables, progressive jackpots and instant games.",
} as const;

export const CATEGORIES = [
  { slug: "slots", label: "Slots", icon: Sparkles, blurb: "Video and classic reels" },
  { slug: "live", label: "Live Casino", icon: Tv, blurb: "Real dealers, streamed in 4K" },
  { slug: "table", label: "Table Games", icon: Layers, blurb: "Blackjack, roulette and more" },
  { slug: "jackpots", label: "Jackpots", icon: Trophy, blurb: "Progressive prize pools" },
  { slug: "instant", label: "Instant Win", icon: Timer, blurb: "Crash, mines and plinko" },
] as const satisfies ReadonlyArray<{
  slug: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
}>;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [CategorySlug, ...CategorySlug[]];

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export const GAME_ICONS: Record<string, LucideIcon> = {
  pyramid: Pyramid,
  seven: Cherry,
  flame: Flame,
  gem: Gem,
  eye: Eye,
  zap: Zap,
  disc: Disc3,
  spade: Spade,
  crown: Crown,
  ferris: FerrisWheel,
  club: Club,
  dice: Dice5,
  vault: Vault,
  flower: Flower2,
  rocket: Rocket,
  bomb: Bomb,
  triangle: Triangle,
  ticket: Ticket,
};

/** Artwork palettes for procedurally rendered game tiles (no third-party art). */
export const PALETTES: Record<string, { from: string; via: string; to: string; glow: string }> = {
  amber: { from: "#3a2a0c", via: "#7a5a1c", to: "#120d05", glow: "#f5cf7a" },
  crimson: { from: "#3d0a12", via: "#7a1426", to: "#12040a", glow: "#ff8a8a" },
  ember: { from: "#3d1406", via: "#8a3410", to: "#140804", glow: "#ffb067" },
  sapphire: { from: "#0a1a3d", via: "#16367a", to: "#050a14", glow: "#8ab4ff" },
  emerald: { from: "#06301f", via: "#0f6a45", to: "#03120c", glow: "#7ef0bd" },
  violet: { from: "#22093d", via: "#4b1a7a", to: "#0b0414", glow: "#c99bff" },
  obsidian: { from: "#1c1c22", via: "#3a3a44", to: "#08080a", glow: "#e8d6a8" },
};

export const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "new", label: "Newest" },
  { value: "rtp", label: "Highest RTP" },
  { value: "name", label: "A to Z" },
] as const;

/**
 * Seeded demo USER account (never an admin). Its password is shown on the login page in
 * development builds only. Admin credentials are never defined in client-reachable code.
 */
export const DEMO_LOGIN = { username: "guest", password: "crownjewels7" } as const;

/** All amounts are cents of play-money credits. */
export const SIGNUP_CREDITS = 10_000_00;
export const DAILY_BONUS = 1_000_00;
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
