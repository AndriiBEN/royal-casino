import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Coins, Dices, ShieldCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { adminMetadata } from "@/lib/admin/meta";
import { getDashboard, getIntegrity, listAudit } from "@/lib/admin/queries";
import { AuditTable } from "@/components/admin/AuditTable";
import { RoundsChart } from "@/components/admin/RoundsChart";
import { Kpi, Panel } from "@/components/admin/ui";
import { cn, formatCredits, formatNumber } from "@/lib/utils";

export const generateMetadata = () => adminMetadata("Dashboard");

export default async function AdminDashboard() {
  await requireAdmin("/admin");
  const [d, integrity, recent] = await Promise.all([getDashboard(), getIntegrity(), listAudit({ scope: "all", page: 1, pageSize: 12 })]);
  const healthy = integrity.mismatchedWallets === 0 && integrity.unauditedEntries === 0;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Dashboard</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} label="Registered accounts" value={formatNumber(d.accounts)} hint={`${d.newWeek} new this week · ${d.admins} admin${d.admins === 1 ? "" : "s"} · ${d.suspended} suspended`} />
        <Kpi icon={Activity} label="Active demo users" value={formatNumber(d.active24)} hint={`last 24 hours · ${formatNumber(d.active7)} in the last 7 days`} />
        <Kpi icon={Dices} label="Games played" value={formatNumber(d.roundsTotal)} hint={`${formatNumber(d.rounds24)} settled rounds in the last 24 hours`} />
        <Kpi
          icon={Coins}
          label="Credits in circulation"
          value={formatCredits(d.circulation, { compact: true })}
          hint={`${formatCredits(d.circulation)} virtual credits${d.pendingDeposits.count ? ` · ${formatCredits(d.pendingDeposits.total, { compact: true })} in ${d.pendingDeposits.count} pending deposit(s)` : ""}`}
        />
      </div>

      <div className={cn("flex flex-col gap-3 rounded-[1.25rem] border px-5 py-4 sm:flex-row sm:items-center", healthy ? "border-jade/30 bg-jade/[0.06]" : "border-ruby/40 bg-ruby/[0.08]")} role="status">
        {healthy ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#8ff0c2]" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-[#ff9aa2]" />}
        <div className="text-sm">
          <p className={cn("font-semibold", healthy ? "text-[#8ff0c2]" : "text-[#ff9aa2]")}>{healthy ? "Ledger integrity: all clear" : "Ledger integrity: attention needed"}</p>
          <p className="text-xs text-muted">
            {integrity.mismatchedWallets} wallet(s) whose balance differs from the ledger · {integrity.unauditedEntries} ledger entr{integrity.unauditedEntries === 1 ? "y" : "ies"} without an audit record. Every balance change must be both.
          </p>
        </div>
        <ShieldCheck className="hidden h-5 w-5 shrink-0 text-subtle sm:ml-auto sm:block" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Rounds per day" description="Settled rounds across all games, last 14 days">
          <div className="p-5">
            <RoundsChart days={d.days} />
          </div>
        </Panel>
        <Panel title="Top games" description="Last 7 days, by rounds played" action={<Link href="/admin/games" className="text-xs font-semibold text-gold hover:text-gold-light">Manage games</Link>}>
          {d.topGames.length ? (
            <table className="w-full text-sm">
              <thead className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">
                <tr className="border-b border-line">
                  <th className="px-5 py-2.5 text-left">Game</th>
                  <th className="px-3 py-2.5 text-right">Rounds</th>
                  <th className="px-5 py-2.5 text-right">Paid out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.topGames.map((g) => (
                  <tr key={g.slug}>
                    <td className="px-5 py-2.5">
                      <Link href={`/games/${g.slug}`} className="text-ivory hover:text-gold-light">
                        {g.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ivory">{formatNumber(g.rounds)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-muted">{g.staked ? `${((g.returned / g.staked) * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-8 text-sm text-muted">No rounds this week.</p>
          )}
        </Panel>
      </div>

      <Panel title="Recent activity" description="Latest audited events across the casino" action={<Link href="/admin/audit?scope=all" className="text-xs font-semibold text-gold hover:text-gold-light">Full audit log</Link>}>
        <AuditTable rows={recent.rows} compact />
      </Panel>
    </div>
  );
}
