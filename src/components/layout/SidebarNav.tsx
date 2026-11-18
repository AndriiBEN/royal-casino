"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";
import { ADMIN_NAV, CATEGORY_NAV, PRIMARY_NAV, SUPPORT_NAV, isActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type SidebarData = {
  categoryCounts: Record<string, number>;
  favoriteCount: number;
  /** Display hint only. The /admin route enforces the role on the server. */
  isAdmin: boolean;
};

function NavLink({
  item,
  active,
  count,
  onNavigate,
  layoutId,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  onNavigate?: () => void;
  layoutId: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
        active ? "text-gold-light" : "text-muted hover:bg-white/[0.03] hover:text-ivory",
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-xl border border-gold/30 bg-gradient-to-r from-gold/15 via-gold/5 to-transparent"
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        />
      )}
      {active && <span className="absolute -left-4 top-2 bottom-2 w-[3px] rounded-r-full bg-gold" />}
      <Icon
        className={cn(
          "relative h-[1.1rem] w-[1.1rem] shrink-0 transition-colors",
          active ? "text-gold" : "text-subtle group-hover:text-gold",
        )}
      />
      <span className="relative flex-1 truncate">{item.label}</span>
      {count != null && count > 0 && (
        <span
          className={cn(
            "relative rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums",
            active ? "bg-gold/20 text-gold-light" : "bg-white/5 text-subtle",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-3 text-[0.62rem] font-bold uppercase tracking-[0.28em] text-subtle">{title}</p>
      <nav className="flex flex-col gap-0.5">{children}</nav>
    </div>
  );
}

export function SidebarNav({
  data,
  onNavigate,
  idPrefix = "desktop",
}: {
  data: SidebarData;
  onNavigate?: () => void;
  idPrefix?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const layoutId = `${idPrefix}-nav-active`;

  return (
    <div className="flex flex-col gap-7">
      <Group title="Casino">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            layoutId={layoutId}
            active={isActive(item, pathname, params)}
            count={item.href.includes("favorites") ? data.favoriteCount : undefined}
            onNavigate={onNavigate}
          />
        ))}
      </Group>

      <Group title="Games">
        {CATEGORY_NAV.map((item) => {
          const slug = new URLSearchParams(item.href.split("?")[1]).get("category") ?? "";
          return (
            <NavLink
              key={item.href}
              item={item}
              layoutId={layoutId}
              active={isActive(item, pathname, params)}
              count={data.categoryCounts[slug]}
              onNavigate={onNavigate}
            />
          );
        })}
      </Group>

      {/* Promo card */}
      <Link
        href="/promotions"
        onClick={onNavigate}
        className="group relative block overflow-hidden rounded-2xl border border-gold/30 p-4"
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgb(212_175_98/0.35),transparent_60%)]" />
        <div className="bg-pattern-deco absolute inset-0 opacity-60" />
        <div className="relative">
          <span className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-gold-gradient text-ink">
            <Gift className="h-4 w-4" />
          </span>
          <p className="font-display text-xl font-semibold leading-tight text-ivory">
            Daily demo bonus
          </p>
          <p className="mt-1 text-xs text-muted">Up to 9,000 credits a day with your streak</p>
          <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gold transition-colors group-hover:text-gold-light">
            See all offers
          </p>
        </div>
      </Link>

      <Group title="Support">
        {(data.isAdmin ? [...SUPPORT_NAV, ADMIN_NAV] : SUPPORT_NAV).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            layoutId={layoutId}
            active={isActive(item, pathname, params)}
            onNavigate={onNavigate}
          />
        ))}
      </Group>
    </div>
  );
}
