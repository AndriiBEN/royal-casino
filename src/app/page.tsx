import { BarChart3, Crown, Flame, Gem, Sparkles, Trophy } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { CasinoStats } from "@/components/home/CasinoStats";
import { FeaturedSpotlight } from "@/components/home/FeaturedSpotlight";
import { RecentWinners } from "@/components/home/RecentWinners";
import { WinnersTicker } from "@/components/home/WinnersTicker";
import { VipTeaser } from "@/components/home/VipTeaser";
import { GameCard } from "@/components/games/GameCard";
import { Rail } from "@/components/ui/Rail";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import {
  getCasinoStats,
  getCategoryCounts,
  getFavoriteIds,
  getFeaturedGames,
  getGames,
  getLobbyStats,
  getNewGames,
  getRecentWins,
  getVipTiers,
} from "@/lib/queries";
import { getTierProgress } from "@/lib/vip";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const [featured, popular, fresh, wins, stats, lobby, counts, favIds, player, tiers] = await Promise.all([
    getFeaturedGames(),
    getGames({ sort: "popular", favorites: false, q: undefined }),
    getNewGames(),
    getRecentWins(10),
    getCasinoStats(),
    getLobbyStats(),
    getCategoryCounts(),
    getFavoriteIds(),
    getCurrentUser(),
    getVipTiers(),
  ]);

  const tier = player && tiers.length ? getTierProgress(player.vipPoints, tiers) : null;
  const cards = (list: typeof popular) =>
    list.map((g) => <GameCard key={g.id} game={g} favorited={favIds.has(g.id)} />);

  return (
    <div className="shell-container space-y-16 py-6 sm:py-8 lg:space-y-24">
      <div className="space-y-5">
        <Hero
          games={[featured[1], featured[0], featured[2]].filter(Boolean)}
          playersOnline={lobby.playersOnline}
          signedIn={Boolean(player)}
        />
        <WinnersTicker wins={wins} />
      </div>

      <section aria-label="Categories">
        <CategoryTiles counts={counts} />
      </section>

      <section>
        <SectionHeader title="Featured games" eyebrow="Hand-picked" icon={Gem} href="/games" hrefLabel="All games" />
        <FeaturedSpotlight games={featured} favIds={favIds} />
      </section>

      <Reveal>
        <section>
          <SectionHeader title="Popular games" eyebrow="Most played" icon={Flame} href="/games?sort=popular" />
          <Rail label="Popular games">{cards(popular.slice(0, 10))}</Rail>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <SectionHeader title="New games" eyebrow="Fresh releases" icon={Sparkles} href="/games?sort=new" />
          <Rail label="New games">{cards(fresh)}</Rail>
        </section>
      </Reveal>

      <VipTeaser
        player={
          tier && player
            ? {
                tierName: tier.current.name,
                nextName: tier.next?.name ?? null,
                points: player.vipPoints,
                progress: tier.progress,
                pointsToNext: tier.pointsToNext,
                dailyBonus: tier.current.dailyBonus,
                level: tier.current.level,
              }
            : null
        }
        tiers={tiers}
      />

      <section className="grid gap-10 xl:grid-cols-[1.15fr_1fr]">
        <div>
          <SectionHeader title="Recent demo winners" eyebrow="Live from the floor" icon={Trophy} />
          <RecentWinners wins={wins} />
        </div>
        <div className="flex flex-col">
          <SectionHeader title="Casino statistics" eyebrow="By the numbers" icon={BarChart3} />
          <CasinoStats stats={stats} className="md:grid-cols-3 xl:grid-cols-2" />
          <Reveal className="mt-5 flex flex-1 flex-col justify-center rounded-[1.75rem] border border-line bg-surface p-6 text-center">
            <Crown className="mx-auto h-6 w-6 text-gold" />
            <p className="mt-3 font-display text-2xl text-ivory">Your seat at the table is waiting</p>
            <p className="mt-1 text-sm text-muted">Statistics update with every round played in this casino.</p>
            <div className="mt-5 flex justify-center">
              <ButtonLink href={player ? "/games" : "/register"} size="sm">
                {player ? "Browse all games" : "Create free account"}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
