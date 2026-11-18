import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt, ScrollText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { historyFilterSchema } from "@/lib/validations";
import { isCurrency } from "@/lib/wallet/currencies";
import { TX_STATUSES, TX_TYPES } from "@/lib/wallet/limits";
import { expireStaleDeposits, getAuditTrail, getHistory, ledgerBalance } from "@/lib/wallet/transactions";
import { TxList, TX_META } from "@/components/wallet/TxList";
import { AuditTrail } from "@/components/wallet/AuditTrail";
import { DemoBadge } from "@/components/wallet/Demo";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatCredits, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Wallet History" };

const PAGE_SIZE = 25;

type Search = { type?: string; status?: string; page?: string };
type Props = { searchParams: Promise<Search> };

function href(base: Search, patch: Search) {
  const q = new URLSearchParams();
  const merged = { ...base, ...patch };
  for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) q.set(k, v);
  const s = q.toString();
  return `/wallet/history${s ? `?${s}` : ""}`;
}

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      scroll={false}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition-colors",
        active ? "border-gold bg-gold/15 text-gold-light" : "border-line text-muted hover:border-gold/40 hover:text-ivory",
      )}
    >
      {children}
    </Link>
  );
}

export default async function HistoryPage({ searchParams }: Props) {
  const user = await requireUser("/wallet/history");
  const wallet = user.wallet;
  if (!wallet) return <EmptyState icon={Receipt} title="No wallet on this account" description="Contact an administrator to open a demo wallet." />;

  const raw = await searchParams;
  const f = historyFilterSchema.parse(raw); // unknown values fall back to "all"
  const current: Search = { type: f.type, status: f.status, page: String(f.page) };
  const display = isCurrency(wallet.displayCurrency) ? wallet.displayCurrency : "CREDITS";

  await expireStaleDeposits(wallet.id);
  const [history, auditRows, ledger] = await Promise.all([
    getHistory(wallet.id, { type: f.type, status: f.status, page: f.page, pageSize: PAGE_SIZE }),
    getAuditTrail(wallet.id, 40),
    ledgerBalance(wallet.id),
  ]);
  const consistent = ledger === wallet.balance;
  const page = Math.min(f.page, history.pages);

  return (
    <div className="space-y-10">
      <section aria-labelledby="hist-h">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 id="hist-h" className="text-3xl text-ivory sm:text-4xl">
                Transaction history
              </h1>
              <DemoBadge />
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatNumber(history.total)} transaction{history.total === 1 ? "" : "s"}
              {f.type || f.status ? " match these filters" : ""}. Amounts in {display === "CREDITS" ? "credits" : `demo ${display}`}.
            </p>
          </div>
          <p
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
              consistent ? "border-jade/40 bg-jade/10 text-[#8ff0c2]" : "border-ruby/40 bg-ruby/10 text-[#ff9aa2]",
            )}
            title="Sum of all completed ledger rows compared with the stored balance"
          >
            {consistent ? "Ledger reconciled" : "Ledger mismatch"} · {formatCredits(ledger)}
          </p>
        </div>

        <div className="mb-5 space-y-2">
          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" aria-label="Filter by type">
            <Chip to={href(current, { type: undefined, page: "1" })} active={!f.type}>
              All types
            </Chip>
            {TX_TYPES.map((t) => (
              <Chip key={t} to={href(current, { type: t, page: "1" })} active={f.type === t}>
                {TX_META[t].label}
              </Chip>
            ))}
          </div>
          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" aria-label="Filter by status">
            <Chip to={href(current, { status: undefined, page: "1" })} active={!f.status}>
              Any status
            </Chip>
            {TX_STATUSES.map((s) => (
              <Chip key={s} to={href(current, { status: s, page: "1" })} active={f.status === s}>
                <span className="capitalize">{s}</span>
              </Chip>
            ))}
          </div>
        </div>

        {history.rows.length ? (
          <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface">
            <TxList rows={history.rows} display={display} />
            {history.pages > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
                {page > 1 ? (
                  <Link href={href(current, { page: String(page - 1) })} className="inline-flex items-center gap-1 text-gold-light hover:underline">
                    <ChevronLeft className="h-4 w-4" /> Newer
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-xs text-subtle">
                  Page {page} of {history.pages}
                </span>
                {page < history.pages ? (
                  <Link href={href(current, { page: String(page + 1) })} className="inline-flex items-center gap-1 text-gold-light hover:underline">
                    Older <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </div>
        ) : (
          <EmptyState icon={Receipt} title="No matching transactions" description="Nothing in your history matches this type and status." action={<ButtonLink href="/wallet/history" variant="outline">Clear filters</ButtonLink>} />
        )}
      </section>

      <section aria-labelledby="audit-h">
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-gold" />
            <h2 id="audit-h" className="text-3xl text-ivory">
              Audit trail
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            Append-only record of every balance change and wallet event, with the balance before and after. Last 40 events.
          </p>
        </div>
        <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface">
          <AuditTrail rows={auditRows} viewerId={user.id} />
        </div>
      </section>
    </div>
  );
}
