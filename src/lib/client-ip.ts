import "server-only";
import { headers } from "next/headers";

/**
 * The client address used for rate limiting, sessions and the audit trail.
 *
 * X-Forwarded-For and X-Real-IP are set by whoever sends the request. `next start` keeps a
 * client-supplied X-Forwarded-For as it is, so trusting it lets anyone pick a fresh "IP" per
 * request and walk straight past the per-IP login and registration limits.
 *
 * They are therefore only read when TRUST_PROXY=1, which you set when the app runs behind a
 * reverse proxy that overwrites those headers. Otherwise every request shares the key
 * "direct", which is what a local, single-machine install sees anyway.
 */
export async function clientIp() {
  if (process.env.TRUST_PROXY !== "1") return "direct";
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || h.get("x-real-ip") || "direct").slice(0, 64);
}
