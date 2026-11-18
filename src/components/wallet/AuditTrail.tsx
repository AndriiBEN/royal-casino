import { ScrollText } from "lucide-react";
import type { AuditRow } from "@/lib/wallet/transactions";
import { formatCredits } from "@/lib/utils";

const LABELS: Record<string, string> = {
  "wallet.opened": "Wallet opened",
  "wallet.signup_credits": "Welcome credits",
  "wallet.display_currency": "Display currency changed",
  "bonus.claimed": "Daily bonus claimed",
  "deposit.created": "Demo deposit created",
  "deposit.confirmed": "Demo deposit confirmed",
  "deposit.cancelled": "Demo deposit cancelled",
  "deposit.expired": "Demo deposit expired",
  "deposit.failed": "Demo deposit failed",
  "game.bet": "Bet placed",
  "game.win": "Win paid",
  "game.refund": "Stake returned",
  "admin.adjustment": "Admin adjustment",
  "admin.role_change": "Role changed by admin",
};

const timeFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "medium" });

function maskIp(ip: string | null) {
  if (!ip) return "—";
  if (ip === "system" || ip === "local") return ip;
  if (ip.includes(".")) return ip.split(".").slice(0, 2).join(".") + ".x.x";
  return ip.split(":").slice(0, 3).join(":") + ":…";
}

function describe(r: AuditRow) {
  if (!r.details) return null;
  try {
    const d = JSON.parse(r.details) as Record<string, string>;
    if (r.action === "wallet.display_currency") return `${d.from} → ${d.to}`;
    if (r.action.startsWith("deposit.") && d.currency) return `${d.cryptoAmount} demo ${d.currency} · ${d.reference}`;
    if (r.action === "admin.adjustment") return d.reason;
    if (r.action === "admin.role_change") return `${d.from} → ${d.to}`;
    if (d.game) return d.game;
  } catch {
    /* details are written by the server as JSON; ignore anything else */
  }
  return null;
}

export function AuditTrail({ rows, viewerId, showOwner = false }: { rows: AuditRow[]; viewerId: string; showOwner?: boolean }) {
  if (!rows.length) {
    return (
      <p className="flex items-center gap-2 px-6 py-8 text-sm text-muted">
        <ScrollText className="h-4 w-4" /> No audit events yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">
          <tr className="border-b border-line">
            <th className="px-5 py-3 font-bold sm:px-6">Time</th>
            {showOwner && <th className="px-3 py-3 font-bold">Wallet</th>}
            <th className="px-3 py-3 font-bold">Event</th>
            <th className="px-3 py-3 text-right font-bold">Change</th>
            <th className="px-3 py-3 text-right font-bold">Balance</th>
            <th className="px-5 py-3 font-bold sm:px-6">By · IP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const extra = describe(r);
            return (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-subtle sm:px-6">{timeFmt.format(r.createdAt)}</td>
                {showOwner && <td className="whitespace-nowrap px-3 py-3 text-xs text-gold-light">{r.wallet?.user.username ?? "—"}</td>}
                <td className="px-3 py-3">
                  <span className="block font-semibold text-ivory">{LABELS[r.action] ?? r.action}</span>
                  {extra && <span className="block max-w-72 truncate text-xs text-muted">{extra}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                  {r.amount != null && r.balanceAfter != null ? (
                    <span className={r.amount > 0 ? "text-[#8ff0c2]" : "text-ivory"}>
                      {r.amount > 0 ? "+" : "−"}
                      {formatCredits(Math.abs(r.amount))}
                    </span>
                  ) : r.amount != null ? (
                    <span className="text-subtle">{formatCredits(Math.abs(r.amount))}</span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-xs tabular-nums text-muted">
                  {r.balanceBefore != null && r.balanceAfter != null
                    ? `${formatCredits(r.balanceBefore)} → ${formatCredits(r.balanceAfter)}`
                    : r.balanceAfter != null
                      ? formatCredits(r.balanceAfter)
                      : "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-xs text-subtle sm:px-6">
                  {r.actorId === viewerId ? "you" : r.actor ? `${r.actor.role === "ADMIN" ? "admin " : ""}${r.actor.username}` : "system"} · {maskIp(r.ip)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
