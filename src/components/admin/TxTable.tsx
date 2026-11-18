import Link from "next/link";
import type { AdminTxRow } from "@/lib/admin/queries";
import { StatusBadge } from "@/components/wallet/Demo";
import { TX_META } from "@/components/wallet/TxList";
import { cn, formatCredits } from "@/lib/utils";
import { dateTimeSec } from "./ui";

export function AdminTxTable({ rows, showUser = true }: { rows: AdminTxRow[]; showUser?: boolean }) {
  if (!rows.length) return <p className="px-5 py-8 text-sm text-muted">No transactions match.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">
          <tr className="border-b border-line">
            <th className="px-5 py-3">Time</th>
            {showUser && <th className="px-3 py-3">Account</th>}
            <th className="px-3 py-3">Type</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Reference</th>
            <th className="px-3 py-3 text-right">Amount</th>
            <th className="px-5 py-3 text-right">Balance after</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((t) => {
            const meta = TX_META[t.type as keyof typeof TX_META];
            const user = t.wallet.user;
            return (
              <tr key={t.id} className="align-top">
                <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-subtle">{dateTimeSec.format(t.createdAt)}</td>
                {showUser && (
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {user.registered ? (
                      <Link href={`/admin/users/${user.id}`} className="text-ivory hover:text-gold-light">
                        @{user.username}
                      </Link>
                    ) : (
                      <span className="text-muted" title="Demo table player (cannot sign in)">@{user.username}</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-3">
                  <span className="font-semibold text-ivory">{meta?.label ?? t.type}</span>
                  {t.game && <span className="block text-xs text-muted">{t.game.name}</span>}
                  {t.type === "deposit" && t.currency && <span className="block text-xs text-muted">{t.cryptoAmount} demo {t.currency}</span>}
                  {t.note && t.type !== "deposit" && <span className="block max-w-64 truncate text-xs text-muted">{t.note}</span>}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-[0.7rem] text-subtle">{t.reference ?? "—"}</td>
                <td className={cn("whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums", t.status !== "completed" ? "text-subtle" : t.amount > 0 ? "text-[#8ff0c2]" : "text-ivory")}>
                  {t.amount > 0 ? "+" : "−"}
                  {formatCredits(Math.abs(t.amount))}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-xs tabular-nums text-muted">{t.balanceAfter != null ? formatCredits(t.balanceAfter) : "not applied"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
