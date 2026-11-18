"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GameDetailSkeleton, LobbySkeleton, PanelsSkeleton, TableSkeleton, TiersSkeleton } from "@/components/ui/Skeletons";

/**
 * Loading feedback for page changes: a thin gold progress bar at once, and, if the next
 * page takes longer than a moment, a skeleton of that page over the current one.
 *
 * Why not loading.tsx: in this Next.js version a route-level Suspense boundary can leave a
 * server action (a deposit, a bonus claim) pending forever after it revalidates. This works
 * purely on the client, so actions are never affected.
 */

const SKELETON_DELAY_MS = 220;
const GIVE_UP_MS = 15_000;

function skeletonFor(path: string) {
  if (/^\/games\/[^/]+\/play/.test(path)) return <TableSkeleton />;
  if (/^\/games\/[^/?]+$/.test(path)) return <GameDetailSkeleton />;
  if (path.startsWith("/games")) return <LobbySkeleton />;
  if (path.startsWith("/wallet")) return <PanelsSkeleton label="Loading wallet" />;
  if (path.startsWith("/profile")) return <PanelsSkeleton label="Loading profile" stats={4} />;
  if (path.startsWith("/admin")) return <PanelsSkeleton label="Loading admin" stats={4} rows={8} />;
  if (path.startsWith("/vip")) return <TiersSkeleton />;
  if (path.startsWith("/promotions")) return <PanelsSkeleton label="Loading promotions" rows={4} />;
  return null;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [target, setTarget] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setTarget(null);
    setShowSkeleton(false);
  };

  // The new page has rendered.
  useEffect(clear, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (or just a #hash): no navigation will happen.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      timers.current.forEach(clearTimeout);
      setTarget(url.pathname);
      timers.current = [
        setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS),
        setTimeout(clear, GIVE_UP_MS),
      ];
    };
    // Capture phase, so it runs before Next's Link handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const skeleton = target && showSkeleton ? skeletonFor(target) : null;

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
        {target && <div className="rc-nav-bar h-full bg-gold-gradient shadow-[0_0_12px_rgb(212_175_98/0.8)]" />}
      </div>
      {skeleton && <div className="rc-skeleton-in fixed inset-x-0 bottom-0 top-[var(--header-h)] z-20 overflow-hidden bg-ink lg:left-[var(--sidebar-w)]">{skeleton}</div>}
    </>
  );
}
