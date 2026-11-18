import type { Metadata } from "next";
import { AlertTriangle, ArrowDownToLine, Clock, Hourglass, Info, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { CURRENCIES, DEPOSIT_CURRENCIES, type DepositCurrency } from "@/lib/wallet/currencies";
import { DEPOSIT_DAILY_CAP, DEPOSIT_MAX, DEPOSIT_MAX_PENDING, DEPOSIT_MIN, DEPOSIT_TTL_MS, MAX_BALANCE } from "@/lib/wallet/limits";
import { demoQrPayload, expireStaleDeposits, getHistory, getPendingDeposits, getWalletSummary } from "@/lib/wallet/transactions";
import { DepositForm } from "@/components/wallet/DepositForm";
import { CopyAddress, DepositActions, ExpiresIn } from "@/components/wallet/DepositActions";
import { DemoQr } from "@/components/wallet/DemoQr";
import { CoinGlyph, DemoBadge, StatusBadge } from "@/components/wallet/Demo";
import { TxList } from "@/components/wallet/TxList";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCredits, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Demo Deposit" };

export default async function DepositPage() {
  const user = await requireUser("/wallet/deposit");
  const wallet = user.wallet;
  if (!wallet) return <EmptyState icon={ArrowDownToLine} title="No wallet on this account" description="Contact an administrator to open a demo wallet." />;

  await expireStaleDeposits(wallet.id);
  const [pending, summary, recent] = await Promise.all([
    getPendingDeposits(wallet.id),
    getWalletSummary(wallet.id),
    getHistory(wallet.id, { type: "deposit", page: 1, pageSize: 6 }),
  ]);

  const remainingToday = Math.max(0, DEPOSIT_DAILY_CAP - summary.depositedToday);
  const defaultCurrency: DepositCurrency = (DEPOSIT_CURRENCIES as readonly string[]).includes(wallet.displayCurrency)
    ? (wallet.displayCurrency as DepositCurrency)
    : "USDT";

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_1fr]">
        <section aria-labelledby="dep-h" className="min-w-0 rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 id="dep-h" className="text-3xl text-ivory sm:text-4xl">
                  Demo deposit
                </h1>
                <DemoBadge />
              </div>
              <p className="mt-1 text-sm text-muted">Simulate a crypto top-up and receive virtual credits. Nothing real is sent or received.</p>
            </div>
          </div>
          <DepositForm defaultCurrency={defaultCurrency} remainingToday={remainingToday} />
        </section>

        <aside className="min-w-0 space-y-5">
          <div className="rounded-[1.75rem] border border-ruby/40 bg-ruby/[0.07] p-6">
            <p className="flex items-center gap-2 text-sm font-bold text-[#ffb3ba]">
              <AlertTriangle className="h-4 w-4" /> Never send real cryptocurrency
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Demo addresses start with <code className="rounded bg-ink px-1 font-mono text-xs text-ivory">DEMO-</code> and are invalid on
              every real network. The QR code contains a warning message, not a payment request. Royal Casino has no way to receive or
              return real funds.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-line bg-surface p-6">
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-subtle">
              <Info className="h-4 w-4 text-gold" /> Demo limits
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Per deposit", `${formatNumber(DEPOSIT_MIN / 100)} – ${formatNumber(DEPOSIT_MAX / 100)}`],
                ["Left today", formatCredits(remainingToday)],
                ["Pending at once", `${pending.length} / ${DEPOSIT_MAX_PENDING}`],
                ["Expires after", `${DEPOSIT_TTL_MS / 60_000} minutes`],
                ["Daily limit", formatNumber(DEPOSIT_DAILY_CAP / 100)],
                ["Max balance", formatNumber(MAX_BALANCE / 100)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-ink/50 px-3 py-2.5">
                  <dt className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-subtle">{k}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-ivory">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-subtle">All amounts in virtual credits. Totals deposited so far: {formatCredits(summary.depositedTotal)}.</p>
          </div>
        </aside>
      </div>

      {/* Pending deposits */}
      <section aria-labelledby="pending-h">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Hourglass className="h-5 w-5 text-gold" />
          <h2 id="pending-h" className="text-3xl text-ivory">
            Pending demo deposits
          </h2>
          <DemoBadge />
        </div>
        {pending.length ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {pending.map((t) => {
              const code = (t.currency ?? "USDT") as DepositCurrency;
              const c = CURRENCIES[code];
              return (
                <article key={t.id} className="relative overflow-hidden rounded-[1.75rem] border border-gold/40 bg-surface p-5 sm:p-6">
                  <div aria-hidden className="bg-demo-stripes absolute inset-x-0 top-0 h-1.5" />
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-[180px_1fr]">
                    <div className="mx-auto w-44 sm:w-full">
                      <DemoQr payload={demoQrPayload(t)} label={t.reference ?? "demo deposit"} />
                    </div>
                    <div className="min-w-0 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <CoinGlyph code={code} size="sm" />
                        <span className="font-semibold text-ivory">{c.name}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div>
                        <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">Simulated amount</p>
                        <p className="break-all text-xl font-bold tabular-nums" style={{ color: c.accent }}>
                          {t.cryptoAmount} {code}
                        </p>
                        <p className="text-xs text-muted">credits {formatCredits(t.amount)} on confirmation</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">Demo address · not real</p>
                        <div className="flex items-center gap-2">
                          <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-line bg-ink px-2.5 py-1.5 font-mono text-[0.7rem] text-ivory">
                            {t.demoAddress}
                          </code>
                          <CopyAddress value={t.demoAddress ?? ""} />
                        </div>
                      </div>
                      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
                        <span className="font-mono">{t.reference}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> expires in {t.expiresAt ? <ExpiresIn at={t.expiresAt.getTime()} /> : "—"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-line pt-5">
                    <DepositActions transactionId={t.id} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="No pending demo deposits" description="Create one above. It stays pending until you simulate the confirmation." />
        )}
      </section>

      <section aria-labelledby="recent-dep-h">
        <h2 id="recent-dep-h" className="mb-4 text-3xl text-ivory">
          Recent demo deposits
        </h2>
        {recent.rows.length ? (
          <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface">
            <TxList rows={recent.rows} />
          </div>
        ) : (
          <p className="text-sm text-muted">No demo deposits yet.</p>
        )}
      </section>
    </div>
  );
}
