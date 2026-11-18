import Link from "next/link";
import type { Game } from "@prisma/client";
import { Info, Play, Users } from "lucide-react";
import { GameArt } from "@/components/games/GameArt";
import { GameCard } from "@/components/games/GameCard";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { getCategory } from "@/lib/constants";
import { formatNumber, formatRtp } from "@/lib/utils";

/** One large spotlight game plus the remaining featured titles. */
export function FeaturedSpotlight({ games, favIds }: { games: Game[]; favIds: Set<string> }) {
  const [lead, ...rest] = games;
  if (!lead) return null;
  const cat = getCategory(lead.category);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
      <Reveal>
        <article className="group relative grid h-full overflow-hidden rounded-[1.75rem] border-gold-gradient shadow-card sm:grid-cols-[15rem_1fr]">
          <Link href={`/games/${lead.slug}`} className="relative block aspect-[4/3] sm:aspect-auto" aria-label={`${lead.name} details`}>
            <GameArt name={lead.name} icon={lead.icon} palette={lead.palette} engine={lead.engine} showTitle={false} />
          </Link>
          <div className="relative flex flex-col justify-center p-6 sm:p-8">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_100%_at_100%_0%,rgb(212_175_98/0.12),transparent_60%)]" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="solid">Spotlight</Badge>
                {cat && <Badge tone="gold">{cat.label}</Badge>}
              </div>
              <h3 className="mt-4 text-4xl text-ivory sm:text-5xl">{lead.name}</h3>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-gold">{lead.studio}</p>
              <p className="mt-4 text-sm leading-relaxed text-muted">{lead.description}</p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
                <span>
                  RTP <b className="text-ivory">{formatRtp(lead.rtp)}</b>
                </span>
                <span className="capitalize">
                  Volatility <b className="text-ivory">{lead.volatility}</b>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-jade" />
                  {formatNumber(lead.players)} playing
                </span>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink href={`/games/${lead.slug}/play`}>
                  <Play className="h-4 w-4 fill-current" />
                  Play now
                </ButtonLink>
                <ButtonLink href={`/games/${lead.slug}`} variant="ghost">
                  <Info className="h-4 w-4" />
                  Details
                </ButtonLink>
              </div>
            </div>
          </div>
        </article>
      </Reveal>

      <div className="grid grid-cols-2 content-center gap-4 sm:grid-cols-3">
        {rest.slice(0, 3).map((g, i) => (
          <Reveal key={g.id} delay={0.08 * (i + 1)}>
            <GameCard game={g} favorited={favIds.has(g.id)} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
