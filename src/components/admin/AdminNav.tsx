"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeftRight, Gamepad2, LayoutDashboard, ScrollText, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/games", label: "Games", icon: Gamepad2 },
  { href: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="scrollbar-none flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("relative flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors sm:px-5", active ? "text-ink" : "text-muted hover:text-ivory")}
          >
            {active && <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-full bg-gold-gradient" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <Icon className="relative h-4 w-4" />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
