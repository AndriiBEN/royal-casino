"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { newRequestId } from "@/lib/request-id";
import type { Played } from "@/lib/games/server/context";

export type RoundState<V> = { roundId: string; version: number; view: V };

/**
 * Client side of a server-authoritative round.
 *
 * - Every call gets a fresh request id. A network failure is retried once with the SAME
 *   id: the server either applies it for the first time or recognises the replay, so a
 *   retry can never charge twice.
 * - The view, version and balance always come from the server's response; nothing here
 *   computes a result or a payout.
 * - On "stale" (another tab moved on, or a double submit) the server's current view is adopted.
 */
export function useRound<V>(initial: RoundState<V> | null, initialBalance: number) {
  const router = useRouter();
  const [round, setRound] = useState<RoundState<V> | null>(initial);
  const [balance, setBalance] = useState(initialBalance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (call: (requestId: string) => Promise<Played<V>>): Promise<Played<V> | null> => {
      if (inFlight.current) return null; // one request at a time from this table
      inFlight.current = true;
      setBusy(true);
      setError(null);
      const requestId = newRequestId();
      let res: Played<V> | null = null;
      try {
        try {
          res = await call(requestId);
        } catch {
          res = await call(requestId); // same id: safe to retry
        }
      } catch {
        setError({ code: "network", message: "Connection lost. Your last action may still have been applied; refresh to check." });
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
      if (!res) return null;
      if (res.balance !== undefined) setBalance(res.balance);
      if (res.ok) {
        setRound({ roundId: res.roundId, version: res.version, view: res.view });
      } else {
        if (res.view && res.roundId !== undefined && res.version !== undefined) setRound({ roundId: res.roundId, version: res.version, view: res.view });
        if (res.error === "auth") router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        else if (res.error !== "stale") setError({ code: res.error, message: res.message });
      }
      return res;
    },
    [router],
  );

  /** Updates the header balance, VIP points and history after a round settles. */
  const refreshShell = useCallback(() => router.refresh(), [router]);

  return { round, setRound, balance, setBalance, busy, error, setError, run, refreshShell };
}
