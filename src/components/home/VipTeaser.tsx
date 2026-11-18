import { Award, Crown, Gift, Lock, UserPlus, UserSquare } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Reveal } from "@/components/ui/Reveal";
import { cn, formatCredits, formatNumber } from "@/lib/utils";
import { tierStyle } from "@/lib/vip";

type PlayerTier = {
  tierName: string;
  nextName: string | null;
  points: number;
  progress: number;
  pointsToNext: number;
  /** cents: this tier's daily bonus base */
  dailyBonus: number;
  level: number;
};

/** VIP promotion: shows the player's progress when signed in, otherwise the tier ladder and a join CTA. */
export function VipTeaser({
  player,
  tiers,
}: {
  player: PlayerTier | null;
  tiers: { name: string; level: number; dailyBonus: number; minPoints: number }[];
}) {
  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-[1.75rem] border-gold-gradient shadow-card">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold/15 blur-3xl" />
        <div aria-hidden className="bg-pattern-deco absolute inset-0 opacity-30 [mask-image:linear-gradient(90deg,black,transparent_60%)]" />
        <Crown aria-hidden className="absolute -bottom-10 -left-8 h-56 w-56 -rotate-12 text-gold/[0.05]" strokeWidth={0.8} />

        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-2 lg:items-center xl:p-14">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.3em] text-gold">The Royal Circle · VIP Club</p>
            <h2 className="mt-3 text-4xl text-ivory sm:text-5xl">
              Rewards fit for <span className="italic text-gold-gradient">royalty</span>
            </h2>
            <p className="mt-4 max-w-md text-muted">
              Every virtual credit you play earns a Crown Point. Climb from Bronze to Diamond for bigger daily bonuses,
              tier-coloured avatar rings and exclusive avatars, and collect achievement badges along the way.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Gift, label: "Bigger daily bonuses" },
                { icon: UserSquare, label: "Exclusive avatars" },
                { icon: Award, label: "20 achievements" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-xs text-ivory/80">
                  <Icon className="h-4 w-4 shrink-0 text-gold" />
                  {label}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              {player ? (
                <ButtonLink href="/vip">Explore VIP benefits</ButtonLink>
              ) : (
                <>
                  <ButtonLink href="/register">
                    <UserPlus className="h-4 w-4" />
                    Join and start earning
                  </ButtonLink>
                  <ButtonLink href="/vip" variant="outline">
                    See all tiers
                  </ButtonLink>
                </>
              )}
            </div>
          </div>

          {player ? (
            <div className="rounded-2xl border border-gold/30 bg-ink/60 p-6 shadow-gold backdrop-blur">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gold-gradient text-ink">
                  <Crown className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-subtle">Your tier</p>
                  <p className="font-display text-3xl font-bold text-gold-gradient">{player.tierName}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-subtle">Daily bonus</p>
                  <p className="font-display text-3xl font-bold text-ivory">{formatCredits(player.dailyBonus, { compact: true })}</p>
                </div>
              </div>
              <div className="mt-7">
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-muted">{formatNumber(player.points)} Crown Points</span>
                  {player.nextName && (
                    <span className="text-gold-light">
                      {formatNumber(player.pointsToNext)} to {player.nextName}
                    </span>
                  )}
                </div>
                <Progress value={player.progress} label={`Progress to ${player.nextName ?? "top tier"}`} />
              </div>
            </div>
          ) : (
            <ol className="space-y-2">
              {tiers.map((t, i) => (
                <li
                  key={t.name}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border bg-ink/60 px-4 py-3 backdrop-blur transition-all hover:border-gold/50",
                    i === tiers.length - 1 ? "border-gold/40" : "border-line",
                  )}
                  style={{ marginLeft: `${i * 4}%` }}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      i === tiers.length - 1 ? "bg-gold-gradient text-ink" : "bg-gold/10 text-gold ring-1 ring-gold/30",
                    )}
                  >
                    {i === tiers.length - 1 ? <Crown className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-lg font-semibold text-ivory">{t.name}</span>
                    <span className="block text-[0.65rem] text-subtle">
                      {t.minPoints ? `${formatNumber(t.minPoints)}+ points` : "From your first spin"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-xl font-bold" style={{ color: tierStyle(t.level).text }}>
                      {formatCredits(t.dailyBonus, { compact: true })}
                    </span>
                    <span className="block text-[0.6rem] text-subtle">daily</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </Reveal>
  );
}
