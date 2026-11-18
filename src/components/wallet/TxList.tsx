import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, Gift, ShieldHalf, Sparkles, Trophy, Undo2 } from "lucide-react";
import { formatIn, type CurrencyCode } from "@/lib/wallet/currencies";
import type { HistoryRow } from "@/lib/wallet/transactions";
import { cn, formatCredits } from "@/lib/utils";
import { StatusBadge } from "./Demo";

export const TX_META = {
  signup: { label: "Welcome credits", icon: Sparkles },
  bonus: { label: "Daily bonus", icon: Gift },
  deposit: { label: "Demo deposit", icon: ArrowDownToLine },
  bet: { label: "Bet", icon: ArrowUpRight },
  win: { label: "Win", icon: Trophy },
  refund: { label: "Stake returned", icon: Undo2 },
  adjustment: { label: "Adjustment", icon: ShieldHalf },
} as const;

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function TxList({ rows, display = "CREDITS" }: { rows: HistoryRow[]; display?: CurrencyCode }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((t) => {
        const meta = TX_META[t.type as keyof typeof TX_META] ?? TX_META.bet;
        const Icon = meta.icon;
        const applied = t.status === "completed";
        const positive = t.amount > 0;
        return (
          <li key={t.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6">
            <span
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl ring-1",
                !applied ? "bg-white/5 text-subtle ring-line" : positive ? "bg-jade/10 text-[#8ff0c2] ring-jade/30" : "bg-white/5 text-muted ring-line",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-sm font-semibold text-ivory">
                  {meta.label}
                  {t.game && (
                    <>
                      {" · "}
                      <Link href={`/games/${t.game.slug}`} className="text-gold-light hover:underline">
                        {t.game.name}
                      </Link>
                    </>
                  )}
                </span>
                {t.multiplier != null && <span className="text-xs text-gold">{t.multiplier.toFixed(1)}x</span>}
                <StatusBadge status={t.status} />
              </span>
              {t.type === "deposit" && t.currency && (
                <span className="block truncate text-xs text-muted">
                  {t.cryptoAmount} demo {t.currency}
                </span>
              )}
              {t.note && t.type !== "deposit" && <span className="block truncate text-xs text-muted">{t.note}</span>}
              {t.type === "deposit" && t.status !== "completed" && t.status !== "pending" && t.note && (
                <span className="block truncate text-xs text-muted">{t.note}</span>
              )}
              <span className="block truncate text-[0.7rem] text-subtle">
                {dateFmt.format(t.createdAt)}
                {t.reference && <span className="ml-2 font-mono">{t.reference}</span>}
              </span>
            </span>
            <span className="text-right">
              <span
                className={cn(
                  "block font-bold tabular-nums",
                  t.status === "pending" ? "text-gold-light" : !applied ? "text-subtle line-through decoration-1" : positive ? "text-[#8ff0c2]" : "text-ivory",
                )}
              >
                {positive ? "+" : "−"}
                {display === "CREDITS" ? formatCredits(Math.abs(t.amount)) : formatIn(Math.abs(t.amount), display)}
              </span>
              <span className="block text-xs tabular-nums text-subtle">
                {t.balanceAfter != null ? (display === "CREDITS" ? formatCredits(t.balanceAfter) : formatIn(t.balanceAfter, display)) : "not applied"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
