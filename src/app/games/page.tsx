import type { Metadata } from "next";
import { Gamepad2, HeartOff, SearchX } from "lucide-react";
import { GameCard, GameGrid } from "@/components/games/GameCard";
import { GameFilters } from "@/components/games/GameFilters";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { getFavoriteIds, getGames } from "@/lib/queries";
import { parseGameFilters } from "@/lib/validations";
import { getCategory } from "@/lib/constants";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filters = parseGameFilters(await searchParams);
  if (filters.favorites) return { title: "Favourites" };
  const cat = filters.category ? getCategory(filters.category) : undefined;
  return { title: cat ? cat.label : "All Games" };
}

export default async function GamesPage({ searchParams }: Props) {
  const filters = parseGameFilters(await searchParams);
  const [games, favIds] = await Promise.all([getGames(filters), getFavoriteIds()]);
  const cat = filters.category ? getCategory(filters.category) : undefined;

  const title = filters.favorites ? "Your favourites" : cat ? cat.label : "The full collection";
  const description = filters.favorites
    ? "The games you have saved, ready whenever you are."
    : cat
      ? `${cat.blurb}. Every title is an original from the Royal Casino house studios.`
      : "Every slot, table, live salon and instant game in the house, sorted the way you like.";

  return (
    <div className="shell-container space-y-8 py-6 sm:py-8">
      <PageHeader
        eyebrow={filters.favorites ? "Saved" : "Game lobby"}
        title={title}
        description={description}
        icon={cat?.icon ?? Gamepad2}
      />

      <GameFilters total={games.length} />

      {games.length > 0 ? (
        <GameGrid>
          {games.map((g) => (
            <GameCard key={g.id} game={g} favorited={favIds.has(g.id)} />
          ))}
        </GameGrid>
      ) : filters.favorites ? (
        <EmptyState
          icon={HeartOff}
          title="No favourites yet"
          description="Tap the heart on any game to save it here for quick access."
          action={<ButtonLink href="/games">Browse games</ButtonLink>}
        />
      ) : (
        <EmptyState
          icon={SearchX}
          title="No games match"
          description={
            filters.q
              ? `We couldn't find anything for "${filters.q}". Try another name or studio.`
              : "No games are listed in this category yet."
          }
          action={
            <ButtonLink href="/games" variant="outline">
              Clear filters
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
