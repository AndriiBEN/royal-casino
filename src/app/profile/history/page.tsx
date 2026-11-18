import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { historyQuerySchema } from "@/lib/validations";
import { ENGINE_LABEL, ENGINES, getGameHistory } from "@/lib/profile/stats";
import { GameHistoryList } from "@/components/profile/GameHistoryList";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Game History" };

const PAGE_SIZE = 20;

type Props = { searchParams: Promise<{ engine?: string; page?: string }> };

const href = (engine: string | undefined, page: number) => {
  const q = new URLSearchParams();
  if (engine) q.set("engine", engine);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return `/profile/history${s ? `?${s}` : ""}`;
};

export default async function GameHistoryPage({ searchParams }: Props) {
  const user = await requireUser("/profile/history");
  const f = historyQuerySchema.parse(await searchParams);
  const history = await getGameHistory(user.id, { engine: f.engine, page: f.page, pageSize: PAGE_SIZE });
  const page = Math.min(f.page, history.pages);

  return (
    <section aria-labelledby="gh-h">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="gh-h" className="text-3xl text-ivory sm:text-4xl">
            Game history
          </h1>
          <p className="mt-1 text-sm text-muted">
            {formatNumber(history.total)} settled {history.total === 1 ? "round" : "rounds"}
            {f.engine ? ` of ${ENGINE_LABEL[f.engine]}` : ""}. Amounts are virtual credits.
          </p>
        </div>
        <nav className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="Filter by game">
          {[undefined, ...ENGINES].map((e) => (
            <Link
              key={e ?? "all"}
              href={href(e, 1)}
              scroll={false}
              aria-current={f.engine === e ? "true" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-xs font-semibold transition-colors",
                f.engine === e ? "border-gold bg-gold/15 text-gold-light" : "border-line text-muted hover:border-gold/40 hover:text-ivory",
              )}
            >
              {e ? ENGINE_LABEL[e] : "All games"}
            </Link>
          ))}
        </nav>
      </div>

      {history.rows.length ? (
        <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface">
          <GameHistoryList rows={history.rows} />
          {history.pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
              {page > 1 ? (
                <Link href={href(f.engine, page - 1)} className="inline-flex items-center gap-1 text-gold-light hover:underline">
                  <ChevronLeft className="h-4 w-4" /> Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-subtle">
                Page {page} of {history.pages}
              </span>
              {page < history.pages ? (
                <Link href={href(f.engine, page + 1)} className="inline-flex items-center gap-1 text-gold-light hover:underline">
                  Older <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      ) : (
        <EmptyState icon={History} title="No rounds here yet" description="Every round you finish is listed here with its stake, result and payout." action={<ButtonLink href="/games">Browse games</ButtonLink>} />
      )}
    </section>
  );
}
