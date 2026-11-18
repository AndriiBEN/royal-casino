import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** Original Royal Casino monogram: a faceted crown inside an octagonal seal. */
export function LogoMark({ className }: { className?: string }) {
  // Unique per instance: a gradient defined inside a display:none SVG cannot be referenced elsewhere.
  const gid = `rc-gold-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 48 48" className={cn("h-10 w-10", className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6E2A8" />
          <stop offset="0.45" stopColor="#D4AF62" />
          <stop offset="1" stopColor="#8A6A2F" />
        </linearGradient>
      </defs>
      <path
        d="M17 2h14l10 10v14l0 10-10 10H17L7 36V12z"
        fill="#0B0B0D"
        stroke={`url(#${gid})`}
        strokeWidth="1.6"
      />
      <path
        d="M19 6h10l8 8v20l-8 8H19l-8-8V14z"
        fill="none"
        stroke={`url(#${gid})`}
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
      <path
        d="M13.5 30.5 12 18l6.2 5.2L24 14l5.8 9.2L36 18l-1.5 12.5z"
        fill={`url(#${gid})`}
      />
      <rect x="13.5" y="32.2" width="21" height="3" rx="1" fill={`url(#${gid})`} />
      <circle cx="12" cy="17.3" r="1.6" fill="#F6E2A8" />
      <circle cx="24" cy="13" r="1.8" fill="#F6E2A8" />
      <circle cx="36" cy="17.3" r="1.6" fill="#F6E2A8" />
      <path d="M24 22.5 26 26l-2 2.6-2-2.6z" fill="#0B0B0D" fillOpacity="0.55" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Royal Casino home"
      className={cn("group flex items-center gap-3", className)}
    >
      <LogoMark className="transition-transform duration-500 group-hover:rotate-[8deg]" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.45rem] font-bold tracking-[0.18em] text-gold-gradient">
            ROYAL
          </span>
          <span className="mt-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.55em] text-muted">
            Casino
          </span>
        </span>
      )}
    </Link>
  );
}
