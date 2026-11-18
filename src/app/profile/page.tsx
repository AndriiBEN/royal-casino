import type { Metadata } from "next";
import Link from "next/link";
import { Award, BarChart3, CalendarDays, ChevronRight, Coins, Dices, Flame, History, Percent, ShieldHalf, Target, Trophy, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getVipTiers } from "@/lib/queries";
import { getTierProgress, tierStyle } from "@/lib/vip";
import { ENGINE_LABEL, ENGINES, getGameHistory, getPlayerStats, syncAchievements } from "@/lib/profile/stats";
import { getDailyBonusInfo } from "@/lib/profile/bonus";
import { Avatar } from "@/components/profile/Avatar";
import { VipCard } from "@/components/profile/VipCard";
import { AchievementBadge } from "@/components/profile/AchievementBadge";
import { GameHistoryList } from "@/components/profile/GameHistoryList";
import { GameBreakdown, NetChart } from "@/components/profile/Charts";
import { DailyBonus } from "@/components/wallet/DailyBonus";
import { StatTile } from "@/components/ui/StatTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatCredits, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Profile" };

const joinedFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const [stats, tiers, bonus, recent] = await Promise.all([
    getPlayerStats(user.id),
    getVipTiers(),
    getDailyBonusInfo(user.id, user.vipPoints),
    getGameHistory(user.id, { page: 1, pageSize: 6 }),
  ]);
  const tier = getTierProgress(user.vipPoints, tiers).current;
  const style = tierStyle(tier.level);
  const achievements = await syncAchievements(user.id, stats, tier.level);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const ordered = [
    ...unlocked.sort((a, b) => b.unlockedAt!.getTime() - a.unlockedAt!.getTime()),
    ...achievements.filter((a) => !a.unlockedAt).sort((a, b) => b.current / b.target - a.current / a.target),
  ];

  return (
    <div className="space-y-10">
      {/* Identity */}
      <section className="relative overflow-hidden rounded-[1.75rem] border border-line bg-surface p-6 sm:p-10">
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(70% 120% at 100% 0%, ${style.ring}2e, transparent 60%)` }} />
        <div aria-hidden className="bg-pattern-deco absolute inset-0 opacity-30 [mask-image:linear-gradient(90deg,transparent,black)]" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-5 sm:gap-7">
            <Avatar avatar={user.avatar} tierLevel={tier.level} size="xl" className="h-20 w-20 sm:h-32 sm:w-32" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-3 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-[0.25em] text-ink" style={{ background: `linear-gradient(90deg, ${style.from}, ${style.to})` }}>
                  {tier.name}
                </span>
                {user.role === "ADMIN" && (
                  <Badge tone="solid">
                    <ShieldHalf className="h-3 w-3" /> Admin
                  </Badge>
                )}
              </div>
              <h1 className="mt-2 break-words text-3xl text-ivory sm:text-5xl">{user.displayName}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span>@{user.username}</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" /> Member since {joinedFmt.format(user.createdAt)}
                </span>
              </p>
            </div>
          </div>

          <Link href="/wallet" className="group rounded-2xl border border-gold/30 bg-ink/50 px-5 py-4 backdrop-blur transition-colors hover:border-gold/60 lg:ml-auto">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.25em] text-subtle">
              <Wallet className="h-3.5 w-3.5 text-gold" /> Virtual balance
            </p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-gold-gradient sm:text-4xl">{formatCredits(user.wallet?.balance ?? 0)}</p>
            <p className="flex items-center gap-1 text-xs text-muted group-hover:text-gold-light">
              Open wallet <ChevronRight className="h-3.5 w-3.5" />
            </p>
          </Link>
        </div>

        <dl className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Demo games played", v: formatNumber(stats.rounds), icon: Dices },
            { k: "Wins", v: formatNumber(stats.wins), icon: Trophy },
            { k: "Total virtual wins", v: formatCredits(stats.wonAmount), icon: Coins },
            { k: "Achievements", v: `${unlocked.length} / ${achievements.length}`, icon: Award },
          ].map(({ k, v, icon: Icon }) => (
            <div key={k} className="rounded-xl border border-line bg-ink/50 px-4 py-3 backdrop-blur">
              <dt className="flex items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">
                <Icon className="h-3.5 w-3.5 text-gold" /> {k}
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-ivory">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* VIP + daily bonus */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
        <VipCard points={user.vipPoints} tiers={tiers} />
        <div className="rounded-[1.5rem] border border-line bg-surface p-6">
          <DailyBonus info={bonus} />
        </div>
      </div>

      {/* Statistics */}
      <section>
        <SectionHeader title="Statistics" eyebrow="Your play" icon={BarChart3} />
        {stats.rounds ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile icon={Percent} label="Win rate" value={`${Math.round(stats.winRate * 100)}%`} hint={`${stats.wins} won · ${stats.pushes} pushed · ${stats.losses} lost`} />
              <StatTile icon={Coins} label="Total staked" value={formatCredits(stats.wagered)} hint={`Net ${stats.net >= 0 ? "+" : "−"}${formatCredits(Math.abs(stats.net))}`} />
              <StatTile icon={Trophy} label="Biggest win" value={stats.biggest ? `+${formatCredits(stats.biggest.amount)}` : "—"} hint={stats.biggest ? `${stats.biggest.game} · best ${stats.bestMultiplier.toFixed(1)}×` : "No wins yet"} />
              <StatTile icon={Flame} label="Longest win streak" value={String(stats.longestWinStreak)} hint={stats.favourite ? `Most played: ${stats.favourite.name}` : undefined} />
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-[1.5rem] border border-line bg-surface p-5 sm:p-6">
                <h3 className="text-xl text-ivory">Net result, last 14 days</h3>
                <p className="mb-4 text-xs text-muted">Virtual credits won minus staked, per day</p>
                <NetChart days={stats.days} />
              </div>
              <div className="rounded-[1.5rem] border border-line bg-surface p-5 sm:p-6">
                <h3 className="text-xl text-ivory">Rounds by game</h3>
                <p className="mb-5 text-xs text-muted">Win rate and net result for each</p>
                <GameBreakdown
                  rows={ENGINES.map((e) => ({
                    label: ENGINE_LABEL[e],
                    rounds: stats.perEngine[e].rounds,
                    wins: stats.perEngine[e].wins,
                    net: stats.perEngine[e].returned - stats.perEngine[e].wagered,
                  }))}
                />
              </div>
            </div>
          </div>
        ) : (
          <EmptyState icon={BarChart3} title="No rounds yet" description="Play any game and your statistics will appear here." action={<ButtonLink href="/games">Browse games</ButtonLink>} />
        )}
      </section>

      {/* Achievements */}
      <section>
        <SectionHeader title="Achievements" eyebrow={`${unlocked.length} of ${achievements.length} unlocked`} icon={Target} />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ordered.map((a) => (
            <AchievementBadge key={a.code} a={a} />
          ))}
        </ul>
      </section>

      {/* Recent history */}
      <section>
        <SectionHeader title="Recent games" icon={History} href="/profile/history" />
        {recent.rows.length ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-line bg-surface">
            <GameHistoryList rows={recent.rows} />
          </div>
        ) : (
          <EmptyState icon={History} title="No games yet" description="Your finished rounds will be listed here." action={<ButtonLink href="/games" variant="outline">Pick a game</ButtonLink>} />
        )}
      </section>
    </div>
  );
}
