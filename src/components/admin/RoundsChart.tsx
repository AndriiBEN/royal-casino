"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/utils";

/** Single series (rounds per day): one hue, validated against the dark surface; title names it, so no legend. */
const BAR = "#B5892A";
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function RoundsChart({ days }: { days: { date: string; rounds: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.rounds));
  const W = 560;
  const H = 170;
  const top = 12;
  const base = H - 22;
  const slot = W / days.length;
  const barW = Math.max(6, slot - 10);
  const active = hover !== null ? days[hover] : null;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Settled rounds per day, last 14 days" onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={top} y2={top} stroke="rgb(255 255 255 / 0.06)" strokeDasharray="2 4" />
        <text x={W - 2} y={top - 3} textAnchor="end" fontSize="9" fill="#8a8578">
          {formatNumber(max)}
        </text>
        {days.map((d, i) => {
          const h = (d.rounds / max) * (base - top);
          const x = i * slot + (slot - barW) / 2;
          const r = Math.min(4, h);
          const path = h < 0.5 ? "" : `M${x} ${base} V${base - h + r} Q${x} ${base - h} ${x + r} ${base - h} H${x + barW - r} Q${x + barW} ${base - h} ${x + barW} ${base - h + r} V${base} Z`;
          return (
            <g key={d.date}>
              <rect x={i * slot} y={top} width={slot} height={base - top} fill={hover === i ? "rgb(255 255 255 / 0.04)" : "transparent"} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${dayFmt.format(new Date(d.date))}: ${d.rounds} rounds`} />
              {path && <path d={path} fill={BAR} opacity={hover === null || hover === i ? 1 : 0.5} pointerEvents="none" />}
              {(i % 2 === 1 || i === days.length - 1) && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#8a8578">
                  {i === days.length - 1 ? "Today" : dayFmt.format(new Date(d.date))}
                </text>
              )}
            </g>
          );
        })}
        <line x1={0} x2={W} y1={base} y2={base} stroke="rgb(255 255 255 / 0.25)" />
      </svg>
      {active && hover !== null && (
        <div role="status" className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line-strong bg-ink/95 px-3 py-2 text-xs shadow-xl" style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}>
          <p className="font-semibold text-ivory">{dayFmt.format(new Date(active.date))}</p>
          <p className="text-muted">
            <b className="tabular-nums text-ivory">{formatNumber(active.rounds)}</b> rounds
          </p>
        </div>
      )}
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer select-none text-subtle hover:text-ivory">View as table</summary>
        <table className="mt-2 w-full">
          <tbody className="divide-y divide-line">
            {days.map((d) => (
              <tr key={d.date}>
                <td className="py-1">{dayFmt.format(new Date(d.date))}</td>
                <td className="py-1 text-right tabular-nums">{d.rounds}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
