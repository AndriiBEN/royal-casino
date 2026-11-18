"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

const FORMATS = {
  integer: (v: number) => new Intl.NumberFormat("en-US").format(Math.round(v)),
  credits: (v: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v / 100),
  compactCredits: (v: number) =>
    new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v / 100),
  percent: (v: number) => `${v.toFixed(1)}%`,
} as const;

/** Animates from 0 to `value` the first time it scrolls into view. */
export function CountUp({
  value,
  format = "integer",
  className,
}: {
  value: number;
  format?: keyof typeof FORMATS;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) return setDisplay(value);
    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {FORMATS[format](display)}
    </span>
  );
}
