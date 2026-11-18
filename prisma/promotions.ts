/**
 * The offers shown on /promotions. Each one describes a feature that really exists in the
 * app, with its real numbers, and links to where it is used. Nothing here is a promise of
 * something the server does not do.
 *
 * Refresh just this table (keeps players and history): npm run db:promotions
 */
export const promotions = [
  {
    slug: "welcome-credits",
    title: "Welcome credits",
    subtitle: "Your table is funded the moment you join",
    description: "Every new account opens with 10,000 demo credits, recorded in your wallet history like any other transaction.",
    reward: "10,000 demo credits",
    kind: "welcome",
    terms: "Credited once, when the account is created\nShown in your wallet history as sign-up credits\nPlay-money credits with no cash value",
    sortOrder: 1,
  },
  {
    slug: "daily-bonus",
    title: "Daily demo bonus",
    subtitle: "Claim once every 24 hours from your wallet",
    description:
      "The base amount grows with your VIP tier, from 1,000 credits at Bronze to 6,000 at Diamond. Come back on consecutive days and each claim adds 10%, up to +50%.",
    reward: "1,000 – 9,000 credits a day",
    kind: "daily",
    terms: "One claim per 24 hours\nThe streak continues if you claim within 48 hours of the last one\nStreak boost: +10% per day, capped at +50%\nPlay-money credits with no cash value",
    sortOrder: 2,
  },
  {
    slug: "free-spins",
    title: "Free spins bonus round",
    subtitle: "Land three or more scatters on any slot",
    description: "Three, four or five scatters anywhere start a bonus round of free spins. Every win during the round pays triple, and scatters can retrigger it.",
    reward: "8, 12 or 20 free spins · wins ×3",
    kind: "feature",
    terms: "3 / 4 / 5 scatters award 8 / 12 / 20 free spins\nFree spins use the bet of the spin that triggered them\nRetriggers add spins, up to 50 banked\nThe round must finish before the next paid spin",
    sortOrder: 3,
  },
  {
    slug: "progressive-jackpots",
    title: "Progressive jackpots",
    subtitle: "A pool that grows with every spin",
    description: "On jackpot slots, 1% of every stake goes into that game's pool. Any spin can win the whole pool, and a bigger stake has a proportionally bigger chance.",
    reward: "Four slots, four growing pools",
    kind: "jackpot",
    terms: "1% of each stake funds the pool\nWinning chance = your contribution ÷ the pool\nThe pool resets to its seed after a win\nPlay-money credits with no cash value",
    sortOrder: 4,
  },
  {
    slug: "vip-club",
    title: "VIP Club",
    subtitle: "Five tiers, from Bronze to Diamond",
    description: "Every whole credit you stake earns one Crown Point. Points raise your tier, which raises your daily bonus and unlocks exclusive avatars and rings.",
    reward: "Up to 6,000 credits base daily bonus",
    kind: "vip",
    terms: "1 Crown Point per credit staked\nTiers never go down\nHigher tiers unlock avatars and a bigger daily bonus",
    sortOrder: 5,
  },
];
