"use client";

import { useSyncExternalStore } from "react";

/**
 * Royal Casino sound. Every effect is synthesised with the Web Audio API (no audio files),
 * so it is tiny, original and works offline.
 *
 * Settings are a per-device preference (like a volume knob), so they live in localStorage.
 * Browsers only allow audio after the player has interacted with the page; the audio
 * context is created lazily on the first sound, which always follows a click or key press.
 */

export type SoundName = "click" | "toggle" | "chip" | "card" | "spin" | "reel" | "wheel" | "win" | "bigWin" | "bonus" | "lose" | "error";
export type SoundGroup = "ui" | "game" | "wins";

const GROUP: Record<SoundName, SoundGroup> = {
  click: "ui",
  toggle: "ui",
  error: "ui",
  chip: "game",
  card: "game",
  spin: "game",
  reel: "game",
  wheel: "game",
  lose: "game",
  win: "wins",
  bigWin: "wins",
  bonus: "wins",
};

export type SoundSettings = { enabled: boolean; volume: number; ui: boolean; game: boolean; wins: boolean };
export const DEFAULT_SOUND: SoundSettings = { enabled: true, volume: 0.6, ui: true, game: true, wins: true };

/* ------------------------------------------------------------------ */
/* Settings store                                                      */
/* ------------------------------------------------------------------ */

const KEY = "rc-sound-v1";
let settings: SoundSettings = DEFAULT_SOUND;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<SoundSettings>;
      settings = {
        enabled: typeof s.enabled === "boolean" ? s.enabled : DEFAULT_SOUND.enabled,
        volume: typeof s.volume === "number" && s.volume >= 0 && s.volume <= 1 ? s.volume : DEFAULT_SOUND.volume,
        ui: typeof s.ui === "boolean" ? s.ui : true,
        game: typeof s.game === "boolean" ? s.game : true,
        wins: typeof s.wins === "boolean" ? s.wins : true,
      };
    }
  } catch {
    /* storage blocked: keep defaults */
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    listeners.forEach((l) => l());
  });
}

export function getSoundSettings() {
  load();
  return settings;
}

export function setSoundSettings(patch: Partial<SoundSettings>) {
  load();
  settings = { ...settings, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* not persisted, still applied for this visit */
  }
  if (master && ctx) master.gain.setTargetAtTime(settings.volume, ctx.currentTime, 0.02);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Current sound settings, re-rendering when they change (in any tab). */
export function useSoundSettings() {
  return useSyncExternalStore(subscribe, getSoundSettings, () => DEFAULT_SOUND);
}

/* ------------------------------------------------------------------ */
/* Synth                                                               */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = settings.volume;
    // A gentle compressor keeps stacked sounds (chord + shimmer) from clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOpts = { at?: number; dur: number; type?: OscillatorType; gain?: number; to?: number; attack?: number };

function tone(freq: number, { at = 0, dur, type = "sine", gain = 0.2, to, attack = 0.005 }: ToneOpts) {
  const c = ctx!;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

type NoiseOpts = { at?: number; dur: number; gain?: number; filter?: BiquadFilterType; freq?: number; to?: number; q?: number };

function noise({ at = 0, dur, gain = 0.2, filter = "bandpass", freq = 2000, to, q = 1 }: NoiseOpts) {
  const c = ctx!;
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** Notes of a bright major (pentatonic) scale used by the win sounds. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

const SOUNDS: Record<SoundName, () => void> = {
  click: () => tone(1900, { dur: 0.035, type: "triangle", gain: 0.08 }),
  toggle: () => {
    tone(880, { dur: 0.06, type: "triangle", gain: 0.09 });
    tone(1320, { at: 0.05, dur: 0.07, type: "triangle", gain: 0.07 });
  },
  error: () => {
    tone(196, { dur: 0.12, type: "square", gain: 0.05 });
    tone(165, { at: 0.13, dur: 0.16, type: "square", gain: 0.05 });
  },
  // two clay chips knocking together
  chip: () => {
    noise({ dur: 0.04, gain: 0.25, filter: "highpass", freq: 3500 });
    tone(3100, { dur: 0.03, type: "triangle", gain: 0.06 });
    noise({ at: 0.05, dur: 0.035, gain: 0.15, filter: "highpass", freq: 4200 });
  },
  // a card sliding off the shoe
  card: () => noise({ dur: 0.11, gain: 0.32, filter: "bandpass", freq: 1400, to: 4200, q: 0.8 }),
  // reels starting: a rising mechanical whir
  spin: () => {
    noise({ dur: 0.55, gain: 0.12, filter: "bandpass", freq: 300, to: 1800, q: 2 });
    tone(110, { dur: 0.5, type: "sawtooth", gain: 0.025, to: 220, attack: 0.08 });
  },
  // a reel locking into place
  reel: () => {
    tone(150, { dur: 0.09, gain: 0.22, to: 70 });
    noise({ dur: 0.05, gain: 0.12, filter: "lowpass", freq: 900 });
  },
  // the ball rattling round the wheel, slowing down
  wheel: () => {
    let t = 0;
    for (let i = 0; i < 26; i++) {
      t += 0.06 + i * i * 0.0009;
      noise({ at: t, dur: 0.025, gain: 0.12 + (i / 26) * 0.08, filter: "highpass", freq: 3000 });
    }
  },
  lose: () => tone(247, { dur: 0.32, type: "sine", gain: 0.07, to: 185, attack: 0.02 }),
  win: () => {
    [0, 2, 4, 5].forEach((n, i) => tone(SCALE[n + 2], { at: i * 0.075, dur: 0.32, type: "triangle", gain: 0.11 }));
    noise({ at: 0.22, dur: 0.4, gain: 0.04, filter: "highpass", freq: 7000 });
  },
  bigWin: () => {
    [0, 2, 4, 5, 7, 9, 10].forEach((n, i) => tone(SCALE[n], { at: i * 0.07, dur: 0.45, type: "triangle", gain: 0.1 }));
    [SCALE[5], SCALE[7], SCALE[8]].forEach((f) => tone(f, { at: 0.5, dur: 1.4, type: "sine", gain: 0.07, attack: 0.05 }));
    noise({ at: 0.45, dur: 1.2, gain: 0.05, filter: "highpass", freq: 8000 });
  },
  bonus: () => {
    for (let i = 0; i < 9; i++) tone(SCALE[(i * 3) % SCALE.length] * 2, { at: i * 0.045, dur: 0.18, type: "sine", gain: 0.06 });
  },
};

/**
 * True once the player has clicked, tapped or pressed a key on this page. Until then a
 * browser keeps audio suspended, and sounds scheduled meanwhile (say, cards dealt on page
 * load) would all play late at once; they are skipped instead.
 */
function interacted() {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
}

/** Plays a sound if sound is on and its group is enabled. Never throws. */
export function playSound(name: SoundName) {
  if (typeof window === "undefined" || !interacted()) return;
  const s = getSoundSettings();
  if (!s.enabled || s.volume <= 0 || !s[GROUP[name]]) return;
  try {
    if (!audio()) return;
    SOUNDS[name]();
  } catch {
    /* audio unavailable */
  }
}

/** For the settings preview: plays regardless of group toggles (still respects master on/off). */
export function previewSound(name: SoundName) {
  if (!getSoundSettings().enabled) return;
  try {
    if (audio()) SOUNDS[name]();
  } catch {
    /* audio unavailable */
  }
}
