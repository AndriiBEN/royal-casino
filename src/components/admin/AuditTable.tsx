import Link from "next/link";
import type { AdminAuditRow } from "@/lib/admin/queries";
import { cn, formatCredits } from "@/lib/utils";
import { dateTimeSec } from "./ui";

export const ACTION_LABEL: Record<string, string> = {
  "admin.adjustment": "Wallet adjustment",
  "admin.role_change": "Role changed",
  "admin.status_change": "Account status changed",
  "admin.sessions_revoked": "Sessions revoked",
  "admin.game_update": "Game updated",
  "wallet.opened": "Wallet opened",
  "wallet.signup_credits": "Welcome credits",
  "wallet.display_currency": "Display currency",
  "bonus.claimed": "Daily bonus claimed",
  "deposit.created": "Demo deposit created",
  "deposit.confirmed": "Demo deposit confirmed",
  "deposit.cancelled": "Demo deposit cancelled",
  "deposit.expired": "Demo deposit expired",
  "deposit.failed": "Demo deposit failed",
  "game.bet": "Stake",
  "game.win": "Win paid",
  "game.refund": "Stake returned",
  "seed.history": "Seeded history",
};

const FIELD: Record<string, string> = { enabled: "enabled", minBet: "min bet", maxBet: "max bet", isFeatured: "featured", isHot: "hot", isNew: "new", config: "payout config", rtp: "published RTP" };

function fmt(field: string, v: unknown) {
  if (typeof v === "boolean") return v ? "on" : "off";
  if ((field === "minBet" || field === "maxBet") && typeof v === "number") return formatCredits(v);
  if (field === "config" && typeof v === "string") {
    try {
      return Object.entries(JSON.parse(v) as Record<string, unknown>).map(([k, x]) => `${k} ${x}`).join(", ") || "default";
    } catch {
      return v;
    }
  }
  if (field === "rtp" && typeof v === "number") return v ? `${v}%` : "n/a";
  return String(v ?? "—");
}

/** Human-readable detail line for an audit entry. Details are written by the server as JSON. */
export function describe(r: Pick<AdminAuditRow, "action" | "details">): string {
  if (!r.details) return "";
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(r.details);
  } catch {
    return "";
  }
  switch (r.action) {
    case "admin.game_update": {
      const changes = d.changes as Record<string, { from: unknown; to: unknown }>;
      const parts = Object.entries(changes ?? {}).map(([k, c]) => `${FIELD[k] ?? k}: ${fmt(k, c.from)} → ${fmt(k, c.to)}`);
      return `${d.name}: ${parts.join("; ")}${d.note ? ` · “${d.note}”` : ""}`;
    }
    case "admin.status_change":
      return `${d.from} → ${d.to} · “${d.reason}”`;
    case "admin.role_change":
      return `${d.from} → ${d.to}`;
    case "admin.adjustment":
      return `“${d.reason}”`;
    case "admin.sessions_revoked":
      return `${d.sessions} session(s) ended`;
    case "deposit.created":
    case "deposit.confirmed":
      return `${d.cryptoAmount ?? ""} demo ${d.currency ?? ""} · ${d.reference ?? ""}`;
    case "wallet.display_currency":
      return `${d.from} → ${d.to}`;
    case "bonus.claimed":
      return d.tier ? `${d.tier} · day ${d.streakDay}` : "";
    default:
      return typeof d.game === "string" ? d.game : "";
  }
}

const maskIp = (ip: string | null) => (!ip ? "—" : ip.includes(".") && !["local", "system"].includes(ip) ? ip.split(".").slice(0, 2).join(".") + ".x.x" : ip);

export function AuditTable({ rows, compact = false }: { rows: AdminAuditRow[]; compact?: boolean }) {
  if (!rows.length) return <p className="px-5 py-8 text-sm text-muted">No events match.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">
          <tr className="border-b border-line">
            <th className="px-5 py-3">Time</th>
            <th className="px-3 py-3">Actor</th>
            <th className="px-3 py-3">Event</th>
            <th className="px-3 py-3">Account</th>
            <th className="px-3 py-3 text-right">Amount</th>
            {!compact && <th className="px-5 py-3">IP</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const adminAction = r.action.startsWith("admin.");
            const detail = describe(r);
            const targetId = r.targetUserId ?? r.wallet?.user.id ?? null;
            return (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-subtle">{dateTimeSec.format(r.createdAt)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs">
                  {r.actor ? (
                    <span className={cn(r.actor.role === "ADMIN" ? "font-semibold text-gold-light" : "text-ivory")}>@{r.actor.username}</span>
                  ) : (
                    <span className="text-subtle">system</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className={cn("flex items-center gap-2 font-semibold", adminAction ? "text-gold-light" : "text-ivory")}>
                    {adminAction && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />}
                    {ACTION_LABEL[r.action] ?? r.action}
                  </span>
                  {detail && <span className={cn("block text-xs text-muted", compact ? "max-w-80 truncate" : "max-w-xl")}>{detail}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs">
                  {r.targetUsername && targetId && r.targetRegistered ? (
                    <Link href={`/admin/users/${targetId}`} className="text-ivory hover:text-gold-light">
                      @{r.targetUsername}
                    </Link>
                  ) : r.targetUsername ? (
                    <span className="text-muted" title="Demo table player (cannot sign in)">@{r.targetUsername}</span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-xs tabular-nums">
                  {r.amount != null ? (
                    <>
                      <span className={r.amount > 0 ? "text-[#8ff0c2]" : "text-ivory"}>
                        {r.amount > 0 ? "+" : "−"}
                        {formatCredits(Math.abs(r.amount))}
                      </span>
                      {r.balanceBefore != null && r.balanceAfter != null && (
                        <span className="block text-subtle">
                          {formatCredits(r.balanceBefore)} → {formatCredits(r.balanceAfter)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
                {!compact && <td className="whitespace-nowrap px-5 py-3 text-xs text-subtle">{maskIp(r.ip)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
