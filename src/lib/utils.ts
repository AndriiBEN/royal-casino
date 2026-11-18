import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an integer amount of cents as credits, e.g. 1234567 -> "12,345.67" */
export function formatCredits(cents: number, opts: { compact?: boolean } = {}) {
  const value = cents / 100;
  if (opts.compact) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** RTP label; hold'em has no house edge (no rake), stored as 0. */
export function formatRtp(rtp: number) {
  return rtp > 0 ? `${rtp.toFixed(1)}%` : "No rake";
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function splitLines(value: string) {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
