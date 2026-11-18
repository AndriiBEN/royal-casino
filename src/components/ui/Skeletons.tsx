import { Crown } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";

/*
 * Route loading skeletons. Each one has the shape of the page it stands in for, so the
 * layout does not jump when the content arrives. Screen readers hear one "Loading" status.
 */

function Frame({ label, children, bare }: { label: string; children: React.ReactNode; bare?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={cn("space-y-8", !bare && "shell-container py-6 sm:py-8")}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Mirrors PageHeader: panel with eyebrow, title and one line of copy, plus a faint crown. */
export function HeaderSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-line bg-surface px-6 py-10 sm:px-10 sm:py-12">
      <Crown aria-hidden className="absolute -right-6 -top-6 h-48 w-48 text-gold/[0.05]" strokeWidth={0.8} />
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-5 h-10 w-2/3 max-w-md sm:h-12" />
      <Skeleton className="mt-5 h-4 w-full max-w-xl" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-surface">
        <Skeleton className="absolute inset-0 rounded-none opacity-60" />
        <div aria-hidden className="absolute inset-2.5 rounded-xl border border-gold/10" />
        <div aria-hidden className="absolute left-1/2 top-[40%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/15" />
      </div>
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/3" />
    </div>
  );
}

export function GameGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function LobbySkeleton() {
  return (
    <Frame label="Loading games">
      <HeaderSkeleton />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-full" />
      <GameGridSkeleton />
    </Frame>
  );
}

export function GameDetailSkeleton() {
  return (
    <Frame label="Loading game">
      <Skeleton className="h-3 w-48" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12">
        <Skeleton className="mx-auto aspect-[3/4] w-full max-w-sm rounded-3xl lg:max-w-none" />
        <div>
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="mt-6 h-14 w-3/4" />
          <Skeleton className="mt-6 h-6 w-1/2" />
          <Skeleton className="mt-6 h-4 w-full max-w-2xl" />
          <Skeleton className="mt-2 h-4 w-5/6 max-w-2xl" />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="mt-8 h-12 w-40 rounded-full" />
        </div>
      </div>
    </Frame>
  );
}

export function TableSkeleton() {
  return (
    <Frame label="Loading table">
      <div>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-4 h-12 w-72 max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[2rem] border border-gold/20 bg-[radial-gradient(120%_90%_at_50%_0%,#17171a,#0d0d0f)] sm:aspect-[16/9]">
          <div className="grid h-28 w-28 place-items-center rounded-full border border-gold/25">
            <Crown className="h-10 w-10 animate-pulse text-gold/50" strokeWidth={1.2} />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-[1.5rem]" />
          <Skeleton className="h-40 rounded-[1.5rem]" />
        </div>
      </div>
    </Frame>
  );
}

/** `bare`: inside a layout that already provides the page container (the admin area). */
export function PanelsSkeleton({ label, stats = 3, rows = 6, bare = false }: { label: string; stats?: number; rows?: number; bare?: boolean }) {
  return (
    <Frame label={label} bare={bare}>
      {!bare && <HeaderSkeleton />}
      <div className={cn("grid gap-4", stats === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3")}>
        {Array.from({ length: stats }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="rounded-[1.5rem] border border-line bg-surface p-5 sm:p-6">
        <Skeleton className="h-6 w-48" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function TiersSkeleton() {
  return (
    <Frame label="Loading VIP club">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-[1.5rem]" />
        ))}
      </div>
    </Frame>
  );
}
