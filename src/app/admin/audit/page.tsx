import { Search } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminMetadata } from "@/lib/admin/meta";
import { listAudit } from "@/lib/admin/queries";
import { ACTION_LABEL, AuditTable } from "@/components/admin/AuditTable";
import { Chip, Pager, Panel, urlWith } from "@/components/admin/ui";
import { formatNumber } from "@/lib/utils";

export const generateMetadata = () => adminMetadata("Audit");

const querySchema = z.object({
  scope: z.enum(["admin", "all"]).catch("admin"),
  action: z.string().max(60).regex(/^[a-z_.]+$/).optional().catch(undefined),
  q: z.string().trim().max(64).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AdminAudit({ searchParams }: Props) {
  await requireAdmin("/admin/audit");
  const f = querySchema.parse(await searchParams);
  const list = await listAudit({ scope: f.scope, action: f.action, q: f.q || undefined, page: f.page, pageSize: 40 });
  const current = { scope: f.scope === "admin" ? undefined : f.scope, action: f.action, q: f.q, page: String(f.page) };
  const u = (patch: Record<string, string | undefined>) => urlWith("/admin/audit", current, { page: "1", ...patch });

  return (
    <Panel
      title="Audit log"
      description={`${formatNumber(list.total)} event${list.total === 1 ? "" : "s"}. Append-only: no screen or action can edit or delete these records.`}
      action={
        <form action="/admin/audit" className="relative w-full sm:w-72" role="search">
          {f.scope === "all" && <input type="hidden" name="scope" value="all" />}
          {f.action && <input type="hidden" name="action" value={f.action} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            name="q"
            defaultValue={f.q}
            placeholder="Admin, game, reason…"
            aria-label="Search the audit log"
            className="h-10 w-full rounded-full border border-line bg-ink pl-9 pr-3 text-sm text-ivory placeholder:text-subtle focus:border-gold/60 focus:outline-none"
          />
        </form>
      }
    >
      <div className="space-y-2 border-b border-line px-5 py-3">
        <div className="flex gap-2">
          <Chip href={u({ scope: undefined, action: undefined })} active={f.scope === "admin"}>
            Administrator actions
          </Chip>
          <Chip href={u({ scope: "all", action: undefined })} active={f.scope === "all"}>
            All activity
          </Chip>
        </div>
        <div className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="Filter by action">
          <Chip href={u({ action: undefined })} active={!f.action}>
            Every action
          </Chip>
          {list.actions.map((a) => (
            <Chip key={a.action} href={u({ action: a.action })} active={f.action === a.action}>
              {ACTION_LABEL[a.action] ?? a.action} <span className="tabular-nums text-subtle">{formatNumber(a.count)}</span>
            </Chip>
          ))}
        </div>
      </div>
      <AuditTable rows={list.rows} />
      <Pager page={Math.min(f.page, list.pages)} pages={list.pages} href={(p) => urlWith("/admin/audit", current, { page: String(p) })} />
    </Panel>
  );
}
