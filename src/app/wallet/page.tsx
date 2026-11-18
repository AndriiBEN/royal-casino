import type { Metadata } from "next";
import { ArrowDownToLine, Clock, PartyPopper, Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUserStats } from "@/lib/queries";
import { getDailyBonusInfo } from "@/lib/profile/bonus";
import { CURRENCIES, DEPOSIT_CURRENCIES, formatIn, isCurrency, rateLabel } from "@/lib/wallet/currencies";
import { expireStaleDeposits, getRecentTransactions, getWalletSummary } from "@/lib/wallet/transactions";
import { DailyBonus } from "@/components/wallet/DailyBonus";
import { CurrencySelector } from "@/components/wallet/CurrencySelector";
import { CoinGlyph, DemoBadge } from "@/components/wallet/Demo";
import { TxList } from "@/components/wallet/TxList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { cn, formatCredits } from "@/lib/utils";

export const metadata: Metadata = { title: "Demo Wallet" };

type Props = { searchParams: Promise<{ welcome?: string }> };

export default async function WalletPage({ searchParams }: Props) {
  const user = await requireUser("/wallet");
  const wallet = user.wallet;
  if (!wallet) {
    return <EmptyState icon={Receipt} title="No wallet on this account" description="Contact an administrator to open a demo wallet." />;
  }

  await expireStaleDeposits(wallet.id);
  const [recent, stats, summary, bonus, { welcome }] = await Promise.all([
    getRecentTransactions(wallet.id, 8),
    getUserStats(wallet.id),
    getWalletSummary(wallet.id),
    getDailyBonusInfo(user.id, user.vipPoints),
    searchParams,
  ]);

  // Always the server's balance. Nothing on this page is computed from browser input.
  const balance = wallet.balance;
  const display = isCurrency(wallet.displayCurrency) ? wallet.displayCurrency : "CREDITS";
  const net = stats.won - stats.wagered;

  return (
    <div className="space-y-8">
      {welcome && (
        <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-5 py-4 text-sm text-gold-light">
          <PartyPopper className="h-5 w-5 shrink-0 text-gold" />
          Welcome to Royal Casino, {user.displayName}. 10,000 demo credits have been added to your wallet.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Main balance */}
        <section aria-labelledby="balance-h" className="relative min-w-0 overflow-hidden rounded-[1.75rem] border-gold-gradient p-6 shadow-gold sm:p-8">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,rgb(212_175_98/0.25),transparent_60%)]" />
          <div aria-hidden className="bg-pattern-deco absolute inset-0 opacity-40" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <h1 id="balance-h" className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-gold">
                  Main virtual balance
                </h1>
                <DemoBadge />
              </div>
              <CurrencySelector current={display} />
            </div>

            <p className="mt-5 break-all font-display text-5xl font-bold tabular-nums text-gold-gradient sm:text-6xl xl:text-7xl">
              {display === "CREDITS" ? formatCredits(balance) : formatIn(balance, display).replace(/ \w+$/, "")}
            </p>
            <p className="mt-1 text-sm text-muted">
              {display === "CREDITS" ? "virtual credits" : `demo ${display} · equals ${formatCredits(balance)} credits at ${rateLabel(display)}`}
            </p>

            {summary.pendingCount > 0 && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-gold-light">
                <Clock className="h-3.5 w-3.5" />
                {formatCredits(summary.pendingTotal)} credits pending in {summary.pendingCount} demo deposit{summary.pendingCount === 1 ? "" : "s"}
              </p>
            )}

            <dl className="mt-8 grid grid-cols-3 gap-3">
              {[
                ["Wagered", formatCredits(stats.wagered)],
                ["Won", formatCredits(stats.won)],
                ["Net", `${net >= 0 ? "+" : "−"}${formatCredits(Math.abs(net))}`],
              ].map(([k, v], i) => (
                <div key={k} className="rounded-xl border border-line bg-ink/60 px-3 py-3 backdrop-blur">
                  <dt className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">{k}</dt>
                  <dd className={cn("mt-1 truncate text-sm font-bold tabular-nums sm:text-base", i === 2 ? (net >= 0 ? "text-[#8ff0c2]" : "text-[#ff9aa2]") : "text-ivory")}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/wallet/deposit">
                <ArrowDownToLine className="h-4 w-4" />
                Demo deposit
              </ButtonLink>
              <ButtonLink href="/games" variant="outline">
                Play games
              </ButtonLink>
            </div>
          </div>
        </section>

        <div className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8">
          <DailyBonus info={bonus} />
        </div>
      </div>

      {/* Demo coin equivalents */}
      <section aria-labelledby="coins-h">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="coins-h" className="text-3xl text-ivory">
            Demo currency view
          </h2>
          <DemoBadge label="Simulated" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {DEPOSIT_CURRENCIES.map((code) => {
            const c = CURRENCIES[code];
            return (
              <div
                key={code}
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-surface p-5 transition-colors",
                  display === code ? "border-gold/60" : "border-line",
                )}
              >
                <div aria-hidden className="absolute -right-6 -top-8 font-display text-[7rem] leading-none opacity-[0.06]" style={{ color: c.accent }}>
                  {c.symbol}
                </div>
                <div className="relative flex items-center gap-3">
                  <CoinGlyph code={code} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ivory">{c.name}</p>
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-subtle">{c.network}</p>
                  </div>
                  <DemoBadge className="ml-auto" />
                </div>
                <p className="relative mt-4 break-all text-xl font-bold tabular-nums sm:text-2xl" style={{ color: c.accent }}>
                  {formatIn(balance, code)}
                </p>
                <p className="relative mt-1 text-xs text-subtle">{rateLabel(code)} · fixed demo rate</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent activity */}
      <section aria-labelledby="recent-h">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-gold" />
            <h2 id="recent-h" className="text-3xl text-ivory">
              Recent transactions
            </h2>
          </div>
          <ButtonLink href="/wallet/history" variant="ghost" size="sm">
            Full history & audit
          </ButtonLink>
        </div>
        {recent.length ? (
          <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface">
            <TxList rows={recent} display={display} />
          </div>
        ) : (
          <EmptyState icon={Receipt} title="No transactions yet" description="Your demo deposits, bets, wins and bonuses will appear here." action={<ButtonLink href="/wallet/deposit">Make a demo deposit</ButtonLink>} />
        )}
      </section>
    </div>
  );
}
