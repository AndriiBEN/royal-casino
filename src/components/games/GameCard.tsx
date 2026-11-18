import Link from "next/link";
import type { Game } from "@prisma/client";
import { Info, Play, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { GameArt } from "./GameArt";
import { FavoriteButton } from "./FavoriteButton";
import { getCategory } from "@/lib/constants";
import { cn, formatCredits, formatNumber } from "@/lib/utils";

export function GameCard({
  game,
  favorited = false,
  className,
}: {
  game: Game;
  favorited?: boolean;
  className?: string;
}) {
  const category = getCategory(game.category);
  const CategoryIcon = category?.icon;

  return (
    <article className={cn("group relative", className)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all duration-500 ease-out group-hover:-translate-y-1.5 group-hover:border-gold/50 group-hover:shadow-gold">
        <GameArt name={game.name} icon={game.icon} palette={game.palette} engine={game.engine} />

        {/* light sweep */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-full z-[5] w-2/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-all duration-1000 group-hover:left-[140%]"
        />

        {/* hover veil */}
        <div className="pointer-events-none absolute inset-0 z-[6] bg-ink/65 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100" />

        {/* Whole card opens the details page */}
        <Link
          href={`/games/${game.slug}`}
          className="absolute inset-0 z-10 rounded-2xl"
          aria-label={`${game.name} details`}
        />

        {/* Hover actions (desktop) */}
        <div className="pointer-events-none absolute inset-0 z-20 hidden flex-col items-center justify-center gap-3 opacity-0 transition-all duration-300 group-hover:opacity-100 sm:flex">
          <Link
            href={`/games/${game.slug}/play`}
            aria-label={`Play ${game.name}`}
            className="pointer-events-auto grid h-16 w-16 translate-y-2 place-items-center rounded-full bg-gold-gradient text-ink shadow-[0_10px_40px_-6px_rgb(212_175_98/0.9)] transition-all duration-300 hover:scale-110 group-hover:translate-y-0"
          >
            <Play className="ml-1 h-7 w-7 fill-current" />
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.24em] text-gold-light">Play now</span>
          <Link
            href={`/games/${game.slug}`}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ivory/80 transition-colors hover:border-gold/60 hover:text-gold"
          >
            <Info className="h-3 w-3" />
            Details
          </Link>
        </div>

        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col items-start gap-1.5">
          {game.isNew && <Badge tone="solid">New</Badge>}
          {game.isHot && <Badge tone="ruby">Hot</Badge>}
          {game.jackpot != null && (
            <Badge tone="gold" className="bg-ink/70 backdrop-blur">
              {formatCredits(game.jackpot, { compact: true })}
            </Badge>
          )}
        </div>

        <FavoriteButton
          gameId={game.id}
          gameName={game.name}
          initial={favorited}
          className="absolute right-3 top-3 z-20"
        />

        {/* Always-visible play button on touch screens */}
        <Link
          href={`/games/${game.slug}/play`}
          aria-label={`Play ${game.name}`}
          className="absolute bottom-3 right-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-gold-gradient text-ink shadow-lg sm:hidden"
        >
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </Link>
      </div>

      <div className="mt-3 flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <h3 className="truncate font-sans text-sm font-semibold text-ivory transition-colors group-hover:text-gold-light">
            {game.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-gold/75">
            {CategoryIcon && <CategoryIcon className="h-3 w-3 shrink-0" />}
            {category?.label ?? game.category}
          </p>
        </div>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[0.7rem] text-muted" title="Players now">
          <Users className="h-3 w-3 text-jade" />
          {formatNumber(game.players)}
        </span>
      </div>
    </article>
  );
}

export function GameGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
