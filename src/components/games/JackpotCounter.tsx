"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { formatCredits } from "@/lib/utils";

/**
 * Counts up to `cents` (the real pool from the database) when scrolled into view.
 * `tick` adds a cosmetic upward drift; it is off by default because the pools are real
 * and the displayed value must match what a win would pay.
 */
export function JackpotCounter({
  cents,
  className,
  tick = false,
}: {
  cents: number;
  className?: string;
  tick?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? cents : Math.round(cents * 0.92));

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(cents);
      return;
    }
    const controls = animate(Math.round(cents * 0.92), cents, {
      duration: 2.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    let id: ReturnType<typeof setInterval> | undefined;
    if (tick) {
      const t = setTimeout(() => {
        id = setInterval(() => setValue((v) => v + Math.ceil(Math.random() * 37)), 1400);
      }, 2300);
      return () => {
        controls.stop();
        clearTimeout(t);
        if (id) clearInterval(id);
      };
    }
    return () => controls.stop();
  }, [inView, cents, tick, reduce]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatCredits(value)}
    </span>
  );
}
