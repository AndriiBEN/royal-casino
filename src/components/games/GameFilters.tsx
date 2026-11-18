"use client";

import Link from "next/link";
import Form from "next/form";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Heart, LayoutGrid, Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, SORT_OPTIONS } from "@/lib/constants";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

function buildHref(params: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `/games?${qs}` : "/games";
}

export function GameFilters({ total }: { total: number }) {
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const category = params.get("category");
  const favorites = params.get("favorites") === "1";
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "popular";

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-semibold tracking-wide transition-all",
      active
        ? "border-gold bg-gold/15 text-gold-light shadow-[0_0_20px_-6px_rgb(212_175_98/0.6)]"
        : "border-line bg-surface text-muted hover:border-gold/40 hover:text-ivory",
    );

  return (
    <div className={cn("space-y-4 transition-opacity", pending && "opacity-70")}>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link href={buildHref(params, { category: null, favorites: null })} className={chip(!category && !favorites)}>
          <LayoutGrid className="h-4 w-4" />
          All
        </Link>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.slug}
              href={buildHref(params, { category: c.slug, favorites: null })}
              className={chip(category === c.slug)}
            >
              <Icon className="h-4 w-4" />
              {c.label}
            </Link>
          );
        })}
        <Link href={buildHref(params, { favorites: favorites ? null : "1", category: null })} className={chip(favorites)}>
          <Heart className={cn("h-4 w-4", favorites && "fill-current")} />
          Favourites
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Form action="/games" className="flex-1" role="search">
          {category && <input type="hidden" name="category" value={category} />}
          {sort !== "popular" && <input type="hidden" name="sort" value={sort} />}
          <Input
            key={q}
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by game or studio"
            aria-label="Search the catalogue"
            icon={<Search className="h-4 w-4" />}
            maxLength={60}
            trailing={
              q ? (
                <Link
                  href={buildHref(params, { q: null })}
                  aria-label="Clear search"
                  className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-muted hover:text-ivory"
                >
                  <X className="h-3.5 w-3.5" />
                </Link>
              ) : undefined
            }
          />
        </Form>

        <div className="flex items-center gap-3">
          <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface-2/80 pl-4 pr-2 text-sm text-muted focus-within:border-gold/60">
            <SlidersHorizontal className="h-4 w-4 text-subtle" />
            <span className="sr-only">Sort by</span>
            <select
              value={sort}
              onChange={(e) =>
                startTransition(() =>
                  router.push(buildHref(params, { sort: e.target.value === "popular" ? null : e.target.value })),
                )
              }
              className="h-full cursor-pointer bg-transparent pr-2 text-ivory focus:outline-none [&>option]:bg-surface"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <p className="whitespace-nowrap text-xs text-subtle" aria-live="polite">
            <b className="text-ivory">{total}</b> {total === 1 ? "game" : "games"}
          </p>
        </div>
      </div>
    </div>
  );
}
