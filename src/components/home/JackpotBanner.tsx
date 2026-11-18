import Link from "next/link";
import type { Game } from "@prisma/client";
import { Trophy } from "lucide-react";
import { JackpotCounter } from "@/components/games/JackpotCounter";
import { GAME_ICONS } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

export function JackpotBanner({ total, games }: { total: number; games: Game[] }) {
  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-[1.75rem] border-gold-gradient">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_140%_at_50%_0%,rgb(212_175_98/0.18),transparent_60%)]" />
        <div aria-hidden className="bg-pattern-deco absolute inset-0 opacity-40" />

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.3em] text-gold">
              <Trophy className="h-4 w-4" />
              Combined progressive pool
            </p>
            <p className="mt-4 font-display text-5xl font-bold leading-none text-gold-gradient sm:text-6xl xl:text-7xl">
              <JackpotCounter cents={total} />
            </p>
            <p className="mt-3 text-sm text-muted">
              Demo credits waiting across {games.length} jackpot games. Any spin could win one.
            </p>
            <ButtonLink href="/games?category=jackpots" className="mt-7">
              Chase the jackpot
            </ButtonLink>
          </div>

          <ul className="grid gap-2.5">
            {games.map((g) => {
              const Icon = GAME_ICONS[g.icon] ?? Trophy;
              return (
                <li key={g.id}>
                  <Link
                    href={`/games/${g.slug}`}
                    className="group flex items-center gap-4 rounded-xl border border-line bg-ink/60 px-4 py-3 backdrop-blur transition-colors hover:border-gold/40"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/30">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ivory group-hover:text-gold-light">
                        {g.name}
                      </span>
                      <span className="block truncate text-xs text-subtle">{g.studio}</span>
                    </span>
                    <span className="font-display text-lg font-bold text-gold-light sm:text-xl">
                      <JackpotCounter cents={g.jackpot ?? 0} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </Reveal>
  );
}
