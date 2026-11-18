import type { Metadata } from "next";
import Link from "next/link";
import { Check, Crown, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { RevealGroup, RevealItem, Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ButtonLink } from "@/components/ui/Button";
import { VipCard } from "@/components/profile/VipCard";
import { Avatar } from "@/components/profile/Avatar";
import { DailyBonus } from "@/components/wallet/DailyBonus";
import { getVipTiers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { getDailyBonusInfo } from "@/lib/profile/bonus";
import { AVATARS } from "@/lib/avatars";
import { bonusFor, getTierProgress, STREAK_MAX_DAYS, STREAK_STEP, tierStyle } from "@/lib/vip";
import { cn, formatCredits, formatNumber, splitLines } from "@/lib/utils";

export const metadata: Metadata = { title: "VIP Club" };

const STEPS = [
  { n: "01", title: "Play", body: "Every virtual credit you stake in any game earns 1 Crown Point. Only simulated play counts; points cannot be bought or transferred." },
  { n: "02", title: "Climb", body: "Points never expire. Pass a threshold and your new tier, ring colour and avatars unlock immediately." },
  { n: "03", title: "Collect", body: `Claim the daily demo bonus. Its base grows with your tier, and every consecutive day adds ${STREAK_STEP}%.` },
];

export default async function VipPage() {
  const [player, tiers] = await Promise.all([getCurrentUser(), getVipTiers()]);
  const tier = player && tiers.length ? getTierProgress(player.vipPoints, tiers) : null;
  const bonus = player ? await getDailyBonusInfo(player.id, player.vipPoints) : null;
  const maxStreakPct = STREAK_STEP * (STREAK_MAX_DAYS - 1);

  return (
    <div className="shell-container space-y-14 py-6 sm:py-8">
      <PageHeader
        eyebrow="The Royal Circle"
        title={
          <>
            An invitation to <span className="italic text-gold-gradient">more</span>
          </>
        }
        description="Five tiers, from Bronze to Diamond. Your progress comes from simulated play with virtual credits, and every benefit below is live."
        icon={Crown}
      >
        {player && tier && (
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-ink/50 p-4 backdrop-blur">
            <Avatar avatar={player.avatar} tierLevel={tier.current.level} size="md" />
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-subtle">Your tier</p>
              <p className="font-display text-2xl font-bold" style={{ color: tierStyle(tier.current.level).text }}>
                {tier.current.name}
              </p>
              <p className="text-xs text-muted">{formatNumber(player.vipPoints)} Crown Points</p>
            </div>
          </div>
        )}
      </PageHeader>

      {player && bonus ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
          <VipCard points={player.vipPoints} tiers={tiers} link={false} />
          <div className="rounded-[1.5rem] border border-line bg-surface p-6">
            <DailyBonus info={bonus} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4 rounded-[1.5rem] border-gold-gradient p-6 sm:flex-row sm:items-center">
          <p className="text-muted">Create a free account to start earning Crown Points and claim your first daily demo bonus.</p>
          <ButtonLink href="/register" className="sm:ml-auto">
            Join the Circle
          </ButtonLink>
        </div>
      )}

      <section>
        <SectionHeader title="How it works" eyebrow="Crown Points" />
        <RevealGroup className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <RevealItem key={s.n}>
              <div className="h-full rounded-2xl border border-line bg-surface p-6">
                <p className="font-display text-5xl font-bold text-gold/30">{s.n}</p>
                <h3 className="mt-3 text-2xl text-ivory">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section>
        <SectionHeader title="The tiers" eyebrow="Benefits" />
        <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {tiers.map((t) => {
            const s = tierStyle(t.level);
            const isCurrent = tier?.current.id === t.id;
            const unlocked = player ? player.vipPoints >= t.minPoints : false;
            const avatars = AVATARS.filter((a) => a.minLevel === t.level);
            return (
              <RevealItem key={t.id}>
                <article className={cn("relative flex h-full flex-col overflow-hidden rounded-2xl p-6 transition-all", isCurrent ? "border-gold-gradient shadow-gold" : "border border-line bg-surface")}>
                  <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${s.from}, ${s.to})` }} />
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: unlocked || !player ? `linear-gradient(145deg, ${s.from}, ${s.to})` : "#232327" }}>
                      {unlocked || !player ? <Crown className="h-5 w-5 text-ink" /> : <Lock className="h-4 w-4 text-subtle" />}
                    </span>
                    {isCurrent && <Badge tone="solid">You</Badge>}
                  </div>
                  <p className="mt-5 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-subtle">Level {t.level}</p>
                  <h3 className="text-3xl" style={{ color: s.text }}>
                    {t.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted">{t.minPoints === 0 ? "From your first round" : `${formatNumber(t.minPoints)}+ Crown Points`}</p>
                  <div className="gold-divider my-5 opacity-50" />
                  <p className="font-display text-3xl font-bold text-ivory">{formatCredits(t.dailyBonus, { compact: true })}</p>
                  <p className="text-xs text-subtle">daily bonus base · up to {formatCredits(bonusFor(t.dailyBonus, STREAK_MAX_DAYS), { compact: true })} with a streak</p>
                  <ul className="mt-5 space-y-2.5">
                    {splitLines(t.perks).map((perk) => (
                      <li key={perk} className="flex gap-2 text-sm text-muted">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  {avatars.length > 0 && (
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5" aria-label={`${avatars.length} avatars unlocked at this tier`}>
                      {avatars.slice(0, 4).map((a) => (
                        <Avatar key={a.id} avatar={a.id} tierLevel={t.level} size="xs" label={`${a.label} avatar`} />
                      ))}
                      {avatars.length > 4 && <span className="grid h-9 min-w-9 place-items-center rounded-full border border-line px-2 text-xs font-semibold text-muted">+{avatars.length - 4}</span>}
                    </div>
                  )}
                </article>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </section>

      <Reveal>
        <p className="mx-auto max-w-2xl text-center text-xs text-subtle">
          Crown Points, tiers and bonuses use virtual credits only and have no monetary value. Points come solely from simulated play: stakes placed in games.
          Deposits, bonuses and adjustments never add points. Streak bonuses grow {STREAK_STEP}% a day up to +{maxStreakPct}%.{" "}
          {player && (
            <Link href="/profile" className="text-gold hover:underline">
              See your achievements
            </Link>
          )}
        </p>
      </Reveal>
    </div>
  );
}
