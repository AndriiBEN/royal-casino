"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { History, LayoutGrid, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/profile", label: "Overview", icon: LayoutGrid },
  { href: "/profile/history", label: "Game history", icon: History },
  { href: "/profile/settings", label: "Account settings", icon: Settings },
] as const;

export function ProfileTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Profile" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/profile" ? pathname === "/profile" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("relative flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors sm:px-5", active ? "text-ink" : "text-muted hover:text-ivory")}
          >
            {active && <motion.span layoutId="profile-tab" className="absolute inset-0 rounded-full bg-gold-gradient" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <Icon className="relative h-4 w-4" />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
