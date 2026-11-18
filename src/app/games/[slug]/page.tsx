import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Coins, Gauge, Percent, Play, Trophy, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { GameArt } from "@/components/games/GameArt";
import { GameCard } from "@/components/games/GameCard";
import { FavoriteButton } from "@/components/games/FavoriteButton";
import { JackpotCounter } from "@/components/games/JackpotCounter";
import { Badge, LiveDot } from "@/components/ui/Badge";
import { Rail } from "@/components/ui/Rail";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatTile } from "@/components/ui/StatTile";
import { Reveal } from "@/components/ui/Reveal";
import { getFavoriteIds, getGameBySlug, getRelatedGames } from "@/lib/queries";
import { getCategory } from "@/lib/constants";
import { slugSchema } from "@/lib/validations";
import { cn, formatCredits, formatNumber, formatRtp } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return getGameBySlug(parsed.data);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = await load((await params).slug);
  return game ? { title: game.name, description: game.tagline } : { title: "Game not found" };
}

const VOLATILITY = { low: 1, medium: 2, high: 3 } as const;

export default async function GamePage({ params }: Props) {
  const game = await load((await params).slug);
  if (!game) notFound();

  const [related, favIds] = await Promise.all([getRelatedGames(game.category, game.id), getFavoriteIds()]);
  const cat = getCategory(game.category);
  const vol = VOLATILITY[game.volatility as keyof typeof VOLATILITY] ?? 2;

  return (
    <div className="shell-container space-y-14 py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-subtle">
        <Link href="/" className="hover:text-gold">Lobby</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/games?category=${game.category}`} className="hover:text-gold">
          {cat?.label ?? "Games"}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-muted" aria-current="page">{game.name}</span>
      </nav>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12">
        <Reveal>
          <div className="group relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl border border-gold/40 shadow-gold lg:max-w-none">
            <GameArt name={game.name} icon={game.icon} palette={game.palette} engine={game.engine} studio={game.studio} size="lg" />
          </div>
        </Reveal>

        <Reveal delay={0.08} className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            {cat && <Badge tone="gold">{cat.label}</Badge>}
            {game.isNew && <Badge tone="solid">New</Badge>}
            {game.isHot && <Badge tone="ruby">Hot</Badge>}
            <span className="inline-flex items-center gap-2 text-xs text-muted">
              <LiveDot />
              {formatNumber(game.players)} playing now
            </span>
          </div>

          <h1 className="mt-5 text-5xl text-ivory sm:text-6xl">{game.name}</h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.24em] text-gold">{game.studio}</p>
          <p className="mt-6 font-display text-2xl italic text-gold-light/90">&ldquo;{game.tagline}&rdquo;</p>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted">{game.description}</p>

          {game.jackpot != null && (
            <div className="mt-8 rounded-2xl border-gold-gradient p-5">
              <p className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.24em] text-gold">
                <Trophy className="h-4 w-4" /> Progressive jackpot
              </p>
              <p className="mt-2 font-display text-4xl font-bold text-gold-gradient sm:text-5xl">
                <JackpotCounter cents={game.jackpot} />
              </p>
            </div>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2 min-[1700px]:grid-cols-4">
            <StatTile icon={Percent} label="Return to player" value={formatRtp(game.rtp)} />
            <StatTile
              icon={Gauge}
              label="Volatility"
              value={
                <span className="flex items-center gap-3 capitalize">
                  {game.volatility}
                  <span className="flex gap-1" aria-hidden>
                    {[1, 2, 3].map((n) => (
                      <span key={n} className={cn("h-3 w-1.5 rounded-sm", n <= vol ? "bg-gold" : "bg-surface-3")} />
                    ))}
                  </span>
                </span>
              }
            />
            <StatTile icon={Coins} label="Min bet" value={formatCredits(game.minBet)} />
            <StatTile icon={Users} label="Max bet" value={formatCredits(game.maxBet, { compact: true })} />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {game.enabled ? (
              <ButtonLink href={`/games/${game.slug}/play`} size="lg">
                <Play className="h-4 w-4 fill-current" />
                Play now
              </ButtonLink>
            ) : (
              <span className="inline-flex h-12 items-center rounded-full border border-line px-6 text-sm font-semibold text-muted">Temporarily unavailable</span>
            )}
            <FavoriteButton gameId={game.id} gameName={game.name} initial={favIds.has(game.id)} variant="full" />
            <Link
              href={`/games?category=${game.category}`}
              className="inline-flex h-11 items-center gap-1 rounded-full px-4 text-sm font-semibold text-muted transition-colors hover:text-gold"
            >
              More {cat?.label.toLowerCase() ?? "games"}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-6 text-xs text-subtle">
            RTP is a theoretical long-term average and does not predict the outcome of any single session.
          </p>
        </Reveal>
      </section>

      {related.length > 0 && (
        <Reveal>
          <section>
            <SectionHeader
              title={`More ${cat?.label ?? "games"}`}
              eyebrow="You may also like"
              href={`/games?category=${game.category}`}
            />
            <Rail label="Related games">
              {related.map((g) => (
                <GameCard key={g.id} game={g} favorited={favIds.has(g.id)} />
              ))}
            </Rail>
          </section>
        </Reveal>
      )}
    </div>
  );
}
