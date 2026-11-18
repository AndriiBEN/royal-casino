import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Coins, Dices, Percent, ShieldHalf, Trophy, UserCog } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminMetadata } from "@/lib/admin/meta";
import { getUserForAdmin, listAudit, listTransactions } from "@/lib/admin/queries";
import { getGameHistory, getPlayerStats } from "@/lib/profile/stats";
import { getVipTiers } from "@/lib/queries";
import { getTierProgress, tierStyle } from "@/lib/vip";
import { Avatar } from "@/components/profile/Avatar";
import { GameHistoryList } from "@/components/profile/GameHistoryList";
import { RoleToggle } from "@/components/admin/AdminControls";
import { AdjustWalletPanel, RevokeSessionsForm, StatusForm } from "@/components/admin/UserForms";
import { AuditTable } from "@/components/admin/AuditTable";
import { AdminTxTable } from "@/components/admin/TxTable";
import { dateTime, Kpi, Panel, RolePill, StatusPill } from "@/components/admin/ui";
import { formatCredits, formatNumber } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export const generateMetadata = () => adminMetadata("User");

export default async function AdminUserPage({ params }: Props) {
  const admin = await requireAdmin("/admin/users");
  const id = z.string().min(1).max(40).safeParse((await params).id);
  if (!id.success) notFound();
  const user = await getUserForAdmin(id.data);
  if (!user) notFound();

  const [stats, tiers, history, txs, auditRows] = await Promise.all([
    getPlayerStats(user.id),
    getVipTiers(),
    getGameHistory(user.id, { page: 1, pageSize: 8 }),
    listTransactions({ userId: user.id, page: 1, pageSize: 12 }),
    listAudit({ scope: "all", userId: user.id, page: 1, pageSize: 15 }),
  ]);
  const tier = getTierProgress(user.vipPoints, tiers).current;
  const isSelf = user.id === admin.id;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted hover:text-gold">
        <ChevronLeft className="h-4 w-4" /> All users
      </Link>

      <section className="relative overflow-hidden rounded-[1.25rem] border border-line bg-surface p-6">
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(60% 120% at 100% 0%, ${tierStyle(tier.level).ring}22, transparent 60%)` }} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar avatar={user.avatar} tierLevel={tier.level} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={user.status} />
              <RolePill role={user.role} />
              <span className="text-xs font-semibold" style={{ color: tierStyle(tier.level).text }}>
                {tier.name} · {formatNumber(user.vipPoints)} pts
              </span>
              {isSelf && <span className="text-xs text-subtle">(you)</span>}
            </div>
            <h1 className="mt-1 break-words text-3xl text-ivory sm:text-4xl">{user.displayName}</h1>
            <p className="text-sm text-muted">
              @{user.username}
              {user.email ? ` · ${user.email}` : ""}
            </p>
            <p className="mt-1 text-xs text-subtle">
              Joined {dateTime.format(user.createdAt)} · last login {user.lastLoginAt ? dateTime.format(user.lastLoginAt) : "never"} · {user._count.achievements} badges
              {user.statusChangedAt && ` · status changed ${dateTime.format(user.statusChangedAt)}${user.statusReason ? ` (“${user.statusReason}”)` : ""}`}
            </p>
          </div>
          <div className="rounded-xl border border-gold/30 bg-ink/60 px-5 py-3 text-right">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-subtle">Balance</p>
            <p className="font-display text-3xl font-bold tabular-nums text-gold-gradient">{formatCredits(user.wallet?.balance ?? 0)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi icon={Dices} label="Rounds" value={formatNumber(stats.rounds)} hint={stats.favourite ? `Most played: ${stats.favourite.name}` : undefined} />
        <Kpi icon={Percent} label="Win rate" value={`${Math.round(stats.winRate * 100)}%`} hint={`${stats.wins} won · ${stats.losses} lost`} />
        <Kpi icon={Coins} label="Staked" value={formatCredits(stats.wagered, { compact: true })} hint={`Net ${stats.net >= 0 ? "+" : "−"}${formatCredits(Math.abs(stats.net))}`} />
        <Kpi icon={Trophy} label="Biggest win" value={stats.biggest ? `+${formatCredits(stats.biggest.amount, { compact: true })}` : "—"} hint={stats.biggest?.game} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Account status" description={user.status === "active" ? "Suspending signs the user out and blocks sign-in." : "Reactivating restores sign-in."}>
          <div className="p-5">
            <StatusForm
              userId={user.id}
              status={user.status}
              disabled={isSelf || (user.role === "ADMIN" && user.status === "active")}
              disabledReason={isSelf ? "You cannot change your own status." : user.role === "ADMIN" ? "Remove admin rights first." : undefined}
            />
          </div>
        </Panel>
        <Panel title="Role" description="Admins can manage users, games and payouts.">
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <ShieldHalf className="h-4 w-4 text-gold" /> Current role: <RolePill role={user.role} />
            </div>
            <RoleToggle userId={user.id} role={user.role} isSelf={isSelf} />
          </div>
        </Panel>
        <Panel title="Sessions" description={`${user._count.sessions} active session(s)`}>
          <div className="p-5">
            <RevokeSessionsForm userId={user.id} sessions={user._count.sessions} disabled={isSelf} />
          </div>
        </Panel>
      </div>

      {user.wallet && (
        <Panel title="Wallet adjustment" description="Credits or debits virtual credits through the ledger. Every adjustment is audited with your name, the reason and the balance before and after.">
          <div className="p-5">
            {isSelf ? (
              <p className="text-sm text-muted">You cannot adjust your own wallet. Another admin has to make this change.</p>
            ) : (
              <AdjustWalletPanel userId={user.id} balance={user.wallet.balance} />
            )}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Recent games" description={`${formatNumber(stats.rounds)} settled rounds`}>
          {history.rows.length ? <GameHistoryList rows={history.rows} /> : <p className="px-5 py-8 text-sm text-muted">No rounds yet.</p>}
        </Panel>
        <Panel title="Audit history" description="Everything recorded about this account">
          <AuditTable rows={auditRows.rows} compact />
        </Panel>
      </div>

      <Panel title="Transactions" description={`${formatNumber(txs.total)} ledger entries`} action={<Link href={`/admin/transactions?q=${user.username}`} className="text-xs font-semibold text-gold hover:text-gold-light">View all</Link>}>
        <AdminTxTable rows={txs.rows} showUser={false} />
      </Panel>

      <p className="flex items-center gap-2 text-xs text-subtle">
        <UserCog className="h-4 w-4" /> Profile details (name, email, password) can only be changed by the player.
      </p>
    </div>
  );
}
