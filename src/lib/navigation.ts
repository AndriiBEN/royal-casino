import { Crown, Gamepad2, Gift, Heart, House, ShieldCheck, ShieldHalf, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { CATEGORIES } from "./constants";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional matcher for active state; receives pathname + search params. */
  match?: (pathname: string, params: URLSearchParams) => boolean;
};

const gamesMatch = (p: string, s: URLSearchParams) =>
  p.startsWith("/games") && !s.get("category") && !s.get("favorites");

/** Main destinations: header (desktop), sidebar and bottom tab bar. */
export const MAIN_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: House, match: (p) => p === "/" },
  { label: "Games", href: "/games", icon: Gamepad2, match: gamesMatch },
  { label: "VIP Club", href: "/vip", icon: Crown, match: (p) => p.startsWith("/vip") },
  { label: "Wallet", href: "/wallet", icon: Wallet, match: (p) => p.startsWith("/wallet") },
  { label: "Profile", href: "/profile", icon: UserRound, match: (p) => p.startsWith("/profile") },
];

export const PRIMARY_NAV: NavItem[] = [
  ...MAIN_NAV.slice(0, 2),
  {
    label: "Favourites",
    href: "/games?favorites=1",
    icon: Heart,
    match: (p, s) => p === "/games" && s.get("favorites") === "1",
  },
  { label: "Promotions", href: "/promotions", icon: Gift, match: (p) => p.startsWith("/promotions") },
  ...MAIN_NAV.slice(2),
];

export const CATEGORY_NAV: NavItem[] = CATEGORIES.map((c) => ({
  label: c.label,
  href: `/games?category=${c.slug}`,
  icon: c.icon,
  match: (p, s) => p === "/games" && s.get("category") === c.slug,
}));

export const SUPPORT_NAV: NavItem[] = [
  {
    label: "Responsible Gaming",
    href: "/responsible-gaming",
    icon: ShieldCheck,
    match: (p) => p.startsWith("/responsible-gaming"),
  },
];

export const ADMIN_NAV: NavItem = {
  label: "Admin",
  href: "/admin",
  icon: ShieldHalf,
  match: (p) => p.startsWith("/admin"),
};

export function isActive(item: { href: string; match?: NavItem["match"] }, pathname: string, params: URLSearchParams) {
  if (item.match) return item.match(pathname, params);
  const [path, query] = item.href.split("?");
  if (path !== pathname) return false;
  if (!query) return params.toString() === "";
  const q = new URLSearchParams(query);
  return [...q.entries()].every(([k, v]) => params.get(k) === v);
}
