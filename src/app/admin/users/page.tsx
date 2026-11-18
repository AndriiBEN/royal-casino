import Link from "next/link";
import { Search, Users } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminMetadata } from "@/lib/admin/meta";
import { listUsers } from "@/lib/admin/queries";
import { getVipTiers } from "@/lib/queries";
import { getTierProgress } from "@/lib/vip";
import { Avatar } from "@/components/profile/Avatar";
import { Chip, dateTime, Pager, Panel, RolePill, StatusPill, urlWith } from "@/components/admin/ui";
import { formatCredits, formatNumber } from "@/lib/utils";

export const generateMetadata = () => adminMetadata("Users");

const querySchema = z.object({
  q: z.string().trim().max(64).optional().catch(undefined),
  role: z.enum(["USER", "ADMIN"]).optional().catch(undefined),
  status: z.enum(["active", "suspended"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AdminUsers({ searchParams }: Props) {
  await requireAdmin("/admin/users");
  const f = querySchema.parse(await searchParams);
  const [list, tiers] = await Promise.all([listUsers({ ...f, q: f.q || undefined, pageSize: 25 }), getVipTiers()]);
  const current = { q: f.q, role: f.role, status: f.status, page: String(f.page) };
  const u = (patch: Record<string, string | undefined>) => urlWith("/admin/users", current, { page: "1", ...patch });

  return (
    <Panel
      title="Users"
      description={`${formatNumber(list.total)} registered account${list.total === 1 ? "" : "s"}${f.q || f.role || f.status ? " match" : ""}`}
      action={
        <form action="/admin/users" className="relative w-full sm:w-72" role="search">
          {f.role && <input type="hidden" name="role" value={f.role} />}
          {f.status && <input type="hidden" name="status" value={f.status} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            name="q"
            defaultValue={f.q}
            placeholder="Search username, name or email"
            aria-label="Search users"
            className="h-10 w-full rounded-full border border-line bg-ink pl-9 pr-3 text-sm text-ivory placeholder:text-subtle focus:border-gold/60 focus:outline-none"
          />
        </form>
      }
    >
      <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-line px-5 py-3">
        <Chip href={u({ role: undefined, status: undefined })} active={!f.role && !f.status}>
          Everyone
        </Chip>
        <Chip href={u({ status: "active" })} active={f.status === "active"}>
          Active
        </Chip>
        <Chip href={u({ status: "suspended" })} active={f.status === "suspended"}>
          Suspended
        </Chip>
        <Chip href={u({ role: "ADMIN" })} active={f.role === "ADMIN"}>
          Admins
        </Chip>
        <Chip href={u({ role: "USER" })} active={f.role === "USER"}>
          Players
        </Chip>
      </div>

      {list.rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">
              <tr className="border-b border-line">
                <th className="px-5 py-3">Account</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">VIP</th>
                <th className="px-3 py-3 text-right">Balance</th>
                <th className="px-3 py-3 text-right">Rounds</th>
                <th className="px-3 py-3">Last login</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.rows.map((r) => {
                const tier = getTierProgress(r.vipPoints, tiers).current;
                return (
                  <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link href={`/admin/users/${r.id}`} className="group flex items-center gap-3">
                        <Avatar avatar={r.avatar} tierLevel={tier.level} size="xs" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ivory group-hover:text-gold-light">{r.displayName}</span>
                          <span className="block truncate text-xs text-muted">
                            @{r.username}
                            {r.email ? ` · ${r.email}` : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-3">
                      <RolePill role={r.role} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {tier.name} · {formatNumber(r.vipPoints)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-gold-light">{formatCredits(r.wallet?.balance ?? 0)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ivory">{formatNumber(r._count.rounds)}</td>
                    <td className="px-3 py-3 text-xs text-muted">{r.lastLoginAt ? dateTime.format(r.lastLoginAt) : "Never"}</td>
                    <td className="px-5 py-3 text-xs text-muted">{dateTime.format(r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="flex items-center gap-2 px-5 py-10 text-sm text-muted">
          <Users className="h-4 w-4" /> No accounts match.
        </p>
      )}
      <Pager page={Math.min(f.page, list.pages)} pages={list.pages} href={(p) => urlWith("/admin/users", current, { page: String(p) })} />
    </Panel>
  );
}
