"use client";

import { useState } from "react";
import { cn, formatCredits } from "@/lib/utils";

/**
 * Chart colours, validated with the dataviz palette checker against the dark card
 * surface (#151515): lightness band, chroma, CVD separation and contrast all pass.
 * Polarity is also encoded by position (above/below the baseline), so colour is never
 * the only cue.
 */
const WIN = "#B5892A";
const LOSS = "#D24E66";
const MAG = "#B5892A";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });

/** Daily net result (won − staked) for the last 14 days: diverging bars around zero. */
export function NetChart({ days }: { days: { date: string; net: number; rounds: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => Math.abs(d.net)));
  const W = 560;
  const H = 180;
  const PAD = { top: 10, bottom: 22, left: 4, right: 4 };
  const mid = PAD.top + (H - PAD.top - PAD.bottom) / 2;
  const half = (H - PAD.top - PAD.bottom) / 2;
  const slot = (W - PAD.left - PAD.right) / days.length;
  const barW = Math.max(6, slot - 8);
  const active = hover !== null ? days[hover] : null;

  return (
    <figure className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: WIN }} /> Net win
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LOSS }} /> Net loss
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Net result per day for the last 14 days" onMouseLeave={() => setHover(null)}>
          {/* recessive grid: max, zero, min */}
          {[mid - half, mid + half].map((y) => (
            <line key={y} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgb(255 255 255 / 0.06)" strokeDasharray="2 4" />
          ))}
          {days.map((d, i) => {
            const h = (Math.abs(d.net) / max) * half;
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const up = d.net >= 0;
            const r = Math.min(4, h);
            // 4px rounded data end, square at the baseline
            const path = h < 0.5
              ? ""
              : up
                ? `M${x} ${mid} V${mid - h + r} Q${x} ${mid - h} ${x + r} ${mid - h} H${x + barW - r} Q${x + barW} ${mid - h} ${x + barW} ${mid - h + r} V${mid} Z`
                : `M${x} ${mid} V${mid + h - r} Q${x} ${mid + h} ${x + r} ${mid + h} H${x + barW - r} Q${x + barW} ${mid + h} ${x + barW} ${mid + h - r} V${mid} Z`;
            return (
              <g key={d.date}>
                {/* hit target: the whole column, larger than the mark */}
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={H - PAD.top - PAD.bottom} fill={hover === i ? "rgb(255 255 255 / 0.04)" : "transparent"} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${dayFmt.format(new Date(d.date))}: ${d.rounds} rounds, net ${d.net >= 0 ? "+" : "−"}${formatCredits(Math.abs(d.net))}`} />
                {path && <path d={path} fill={up ? WIN : LOSS} opacity={hover === null || hover === i ? 1 : 0.45} pointerEvents="none" />}
                {d.rounds > 0 && h < 0.5 && <circle cx={x + barW / 2} cy={mid} r={2} fill="rgb(255 255 255 / 0.4)" pointerEvents="none" />}
                {(i === 0 || i === days.length - 1 || i % 2 === 1) && (
                  <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#8a8578">
                    {i === days.length - 1 ? "Today" : weekday.format(new Date(d.date))}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={mid} y2={mid} stroke="rgb(255 255 255 / 0.25)" />
        </svg>
        {active && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line-strong bg-ink/95 px-3 py-2 text-xs shadow-xl"
            style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
            role="status"
          >
            <p className="font-semibold text-ivory">{dayFmt.format(new Date(active.date))}</p>
            <p className="text-muted">
              Net <span className="font-bold tabular-nums text-ivory">{active.net >= 0 ? "+" : "−"}{formatCredits(Math.abs(active.net))}</span>
            </p>
            <p className="text-muted">{active.rounds} {active.rounds === 1 ? "round" : "rounds"}</p>
          </div>
        )}
      </div>
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer select-none text-subtle hover:text-ivory">View as table</summary>
        <table className="mt-2 w-full">
          <thead className="text-subtle">
            <tr>
              <th className="py-1 text-left font-semibold">Day</th>
              <th className="py-1 text-right font-semibold">Rounds</th>
              <th className="py-1 text-right font-semibold">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {days.map((d) => (
              <tr key={d.date}>
                <td className="py-1">{dayFmt.format(new Date(d.date))}</td>
                <td className="py-1 text-right tabular-nums">{d.rounds}</td>
                <td className="py-1 text-right tabular-nums text-ivory">{d.net >= 0 ? "+" : "−"}{formatCredits(Math.abs(d.net))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Rounds per game type: one series, one hue, values labelled directly. */
export function GameBreakdown({ rows }: { rows: { label: string; rounds: number; wins: number; net: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.rounds));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ivory">{r.label}</span>
            <span className="text-xs tabular-nums text-muted">
              <b className="text-ivory">{r.rounds}</b> rounds · {r.rounds ? Math.round((r.wins / r.rounds) * 100) : 0}% won ·{" "}
              <span className={cn(r.net > 0 ? "text-ivory" : "text-muted")}>{r.net >= 0 ? "+" : "−"}{formatCredits(Math.abs(r.net))}</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.06]">
            <div className="h-full rounded-r-[4px] rounded-l-[2px] transition-[width] duration-700" style={{ width: `${(r.rounds / max) * 100}%`, background: MAG, minWidth: r.rounds ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
