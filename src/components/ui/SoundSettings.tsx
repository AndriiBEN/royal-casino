"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { playSound, previewSound, setSoundSettings, useSoundSettings, type SoundName, type SoundSettings } from "@/lib/sound";
import { cn } from "@/lib/utils";

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40",
        checked ? "border-gold bg-gold-gradient" : "border-line-strong bg-surface-3",
      )}
    >
      <span className={cn("absolute top-0.5 h-[1.15rem] w-[1.15rem] rounded-full shadow transition-all", checked ? "left-[1.35rem] bg-ink" : "left-0.5 bg-muted")} />
    </button>
  );
}

const GROUPS: { key: "ui" | "game" | "wins"; label: string; hint: string; sample: SoundName }[] = [
  { key: "game", label: "Table sounds", hint: "Reels, cards, chips and the roulette ball", sample: "card" },
  { key: "wins", label: "Win fanfares", hint: "Chimes for wins, jackpots and free spins", sample: "win" },
  { key: "ui", label: "Interface", hint: "Toggles and error tones", sample: "toggle" },
];

/** All sound controls. Used on the settings page and, compact, in the header menu. */
export function SoundControls({ compact = false }: { compact?: boolean }) {
  const s = useSoundSettings();
  const volId = useId();
  const set = (patch: Partial<SoundSettings>) => {
    setSoundSettings(patch);
    if (patch.enabled) previewSound("toggle");
  };
  const pct = Math.round(s.volume * 100);

  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-ivory">Sound</p>
          {!compact && <p className="text-sm text-muted">Every sound is synthesised in your browser. Settings are saved on this device.</p>}
        </div>
        <Switch checked={s.enabled} onChange={(v) => set({ enabled: v })} label="Sound" />
      </div>

      <div className={cn("space-y-2", !s.enabled && "opacity-40")}>
        <div className="flex items-center justify-between text-sm">
          <label htmlFor={volId} className="text-muted">Volume</label>
          <span className="tabular-nums text-ivory">{pct}%</span>
        </div>
        <input
          id={volId}
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          disabled={!s.enabled}
          onChange={(e) => setSoundSettings({ volume: Number(e.target.value) / 100 })}
          onPointerUp={() => previewSound("chip")}
          onKeyUp={() => previewSound("chip")}
          className="rc-range w-full"
          style={{ ["--pct" as string]: `${pct}%` }}
        />
      </div>

      <ul className={cn("divide-y divide-line rounded-2xl border border-line", !s.enabled && "opacity-40")}>
        {GROUPS.map((g) => (
          <li key={g.key} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ivory">{g.label}</p>
              {!compact && <p className="text-xs text-muted">{g.hint}</p>}
            </div>
            <button
              type="button"
              onClick={() => previewSound(g.sample)}
              disabled={!s.enabled}
              className="rounded-full px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/10 disabled:pointer-events-none"
            >
              Play sample
            </button>
            <Switch checked={s[g.key]} onChange={(v) => setSoundSettings({ [g.key]: v })} label={g.label} disabled={!s.enabled} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Header button: shows the current state and opens the sound controls. */
export function SoundMenu({ signedIn }: { signedIn: boolean }) {
  const s = useSoundSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Server render and first paint use the default (sound on) to avoid a hydration mismatch.
  const on = mounted ? s.enabled && s.volume > 0 : true;
  const Icon = !on ? VolumeX : s.volume < 0.5 ? Volume1 : Volume2;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          playSound("click");
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={on ? "Sound on. Open sound settings" : "Sound off. Open sound settings"}
        className={cn(
          "grid h-10 w-10 place-items-center rounded-full border transition-colors",
          open ? "border-gold/60 text-gold" : "border-line text-muted hover:border-gold/40 hover:text-gold",
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Sound settings"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] origin-top-right rounded-2xl border border-line-strong bg-surface-2/95 p-4 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.95)] backdrop-blur-xl"
          >
            <SoundControls compact />
            {signedIn && (
              <Link href="/profile/settings#sound" onClick={() => setOpen(false)} className="mt-3 block text-center text-xs font-semibold text-gold hover:underline">
                All sound settings
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
