import { Search } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminMetadata } from "@/lib/admin/meta";
import { listTransactions } from "@/lib/admin/queries";
import { TX_STATUSES, TX_TYPES } from "@/lib/wallet/limits";
import { TX_META } from "@/components/wallet/TxList";
import { AdminTxTable } from "@/components/admin/TxTable";
import { Chip, Pager, Panel, urlWith } from "@/components/admin/ui";
import { formatNumber } from "@/lib/utils";

export const generateMetadata = () => adminMetadata("Transactions");

const querySchema = z.object({
  q: z.string().trim().max(64).optional().catch(undefined),
  status: z.enum(TX_STATUSES).optional().catch(undefined),
  type: z.enum(TX_TYPES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AdminTransactions({ searchParams }: Props) {
  await requireAdmin("/admin/transactions");
  const f = querySchema.parse(await searchParams);
  const list = await listTransactions({ q: f.q || undefined, status: f.status, type: f.type, page: f.page, pageSize: 30 });
  const current = { q: f.q, status: f.status, type: f.type, page: String(f.page) };
  const u = (patch: Record<string, string | undefined>) => urlWith("/admin/transactions", current, { page: "1", ...patch });
  const allCount = Object.values(list.statusCounts).reduce((a, b) => a + b, 0);

  return (
    <Panel
      title="Demo transactions"
      description={`${formatNumber(list.total)} ledger entr${list.total === 1 ? "y" : "ies"}. Virtual credits only; pending, failed, cancelled and expired rows never changed a balance.`}
      action={
        <form action="/admin/transactions" className="relative w-full sm:w-72" role="search">
          {f.status && <input type="hidden" name="status" value={f.status} />}
          {f.type && <input type="hidden" name="type" value={f.type} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            name="q"
            defaultValue={f.q}
            placeholder="Username or reference"
            aria-label="Search transactions"
            className="h-10 w-full rounded-full border border-line bg-ink pl-9 pr-3 text-sm text-ivory placeholder:text-subtle focus:border-gold/60 focus:outline-none"
          />
        </form>
      }
    >
      <div className="space-y-2 border-b border-line px-5 py-3">
        <div className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="Filter by status">
          <Chip href={u({ status: undefined })} active={!f.status}>
            Any status <span className="tabular-nums text-subtle">{formatNumber(allCount)}</span>
          </Chip>
          {TX_STATUSES.map((s) => (
            <Chip key={s} href={u({ status: s })} active={f.status === s}>
              <span className="capitalize">{s}</span> <span className="tabular-nums text-subtle">{formatNumber(list.statusCounts[s] ?? 0)}</span>
            </Chip>
          ))}
        </div>
        <div className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="Filter by type">
          <Chip href={u({ type: undefined })} active={!f.type}>
            All types
          </Chip>
          {TX_TYPES.map((t) => (
            <Chip key={t} href={u({ type: t })} active={f.type === t}>
              {TX_META[t].label}
            </Chip>
          ))}
        </div>
      </div>
      <AdminTxTable rows={list.rows} />
      <Pager page={Math.min(f.page, list.pages)} pages={list.pages} href={(p) => urlWith("/admin/transactions", current, { page: String(p) })} />
    </Panel>
  );
}
