"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { cn, formatCredits } from "@/lib/utils";
import { playSound, type SoundName } from "@/lib/sound";

/** Balance + optional stat, shown under every table. Values come from the server. */
export function Hud({ balance, label, value, tone }: { balance: number; label?: string; value?: string; tone?: "win" | "loss" | "neutral" }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-ink/70 px-4 py-3">
      <Wallet className="h-4 w-4 shrink-0 text-gold" />
      <div className="min-w-0">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">Balance</p>
        <p className="font-bold tabular-nums text-gold-light">{formatCredits(balance)}</p>
      </div>
      {label && (
        <div className="ml-auto min-w-0 text-right">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">{label}</p>
          <p className={cn("truncate font-bold tabular-nums", tone === "win" ? "text-[#8ff0c2]" : tone === "loss" ? "text-[#ff9aa2]" : "text-ivory")}>{value}</p>
        </div>
      )}
    </div>
  );
}

export function ErrorLine({ error }: { error: { code: string; message: string } | null }) {
  useEffect(() => {
    if (error) playSound("error");
  }, [error]);
  return (
    <div className="min-h-6 text-center text-sm" aria-live="assertive">
      {error && (
        <p className="text-[#ff9aa2]">
          {error.message}{" "}
          {error.code === "funds" && (
            <Link href="/wallet" className="font-semibold text-gold underline-offset-4 hover:underline">
              Top up in your wallet
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

/** Big centred result banner. Dismisses itself after `autoHideMs` so it never hides the table for long. */
export function ResultBanner({
  show,
  title,
  amount,
  sub,
  tone = "win",
  id,
  autoHideMs = 2800,
  sound,
}: {
  show: boolean;
  title: string;
  amount?: string;
  sub?: string;
  tone?: "win" | "loss" | "neutral";
  id: string | number;
  autoHideMs?: number;
  /** sound when the banner appears; defaults to a win chime or a soft loss tone */
  sound?: SoundName | null;
}) {
  const [hiddenId, setHiddenId] = useState<string | number | null>(null);
  useEffect(() => {
    if (!show || !autoHideMs) return;
    const t = setTimeout(() => setHiddenId(id), autoHideMs);
    return () => clearTimeout(t);
  }, [show, id, autoHideMs]);
  const visible = show && hiddenId !== id;
  const cue = sound === undefined ? (tone === "win" ? "win" : tone === "loss" ? "lose" : null) : sound;
  useEffect(() => {
    if (show && cue) playSound(cue);
    // once per banner (id), not on every re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, id]);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={id}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
        >
          <div
            role="status"
            className={cn(
              "rounded-2xl border px-6 py-3 text-center backdrop-blur-md sm:px-10 sm:py-4",
              tone === "win" ? "border-gold bg-ink/85 shadow-gold" : tone === "loss" ? "border-ruby/50 bg-ink/85" : "border-line-strong bg-ink/85",
            )}
          >
            <p className={cn("text-[0.65rem] font-bold uppercase tracking-[0.3em]", tone === "loss" ? "text-[#ff9aa2]" : "text-gold")}>{title}</p>
            {amount && <p className={cn("font-display text-3xl font-bold sm:text-5xl", tone === "win" ? "text-gold-gradient" : "text-ivory")}>{amount}</p>}
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Casino chip used for bet selection and on the felt. */
export function Chip({ value, selected, onClick, size = "md", disabled }: { value: number; selected?: boolean; onClick?: () => void; size?: "sm" | "md"; disabled?: boolean }) {
  const palette = value >= 100_00 ? ["#1a1a1a", "#D4AF62"] : value >= 25_00 ? ["#2b1a4d", "#c9b0ff"] : value >= 5_00 ? ["#0f3d2a", "#8ff0c2"] : value >= 1_00 ? ["#5a0e1c", "#ffb3ba"] : ["#e9e3d3", "#151515"];
  const label = value >= 100_00 ? `${value / 100_00}K`.replace(".", ",") : value >= 100 ? String(value / 100) : `.${String(value).padStart(2, "0")}`;
  const dims = size === "sm" ? "h-7 w-7 text-[0.6rem]" : "h-12 w-12 text-xs";
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick: () => { playSound("chip"); onClick(); }, disabled, "aria-pressed": selected, "aria-label": `Chip ${formatCredits(value)} credits` } : { "aria-hidden": true })}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full font-extrabold tabular-nums transition-transform",
        dims,
        onClick && "hover:-translate-y-0.5 disabled:opacity-40",
        selected && "-translate-y-1 ring-2 ring-gold ring-offset-2 ring-offset-ink",
      )}
      style={{
        background: `repeating-conic-gradient(${palette[0]} 0 30deg, ${palette[1]} 30deg 45deg)`,
        color: palette[1],
        boxShadow: "0 4px 10px -2px rgb(0 0 0 / 0.7)",
      }}
    >
      <span className="absolute inset-[18%] grid place-items-center rounded-full border border-white/30" style={{ background: palette[0] }}>
        {label}
      </span>
    </Tag>
  );
}
