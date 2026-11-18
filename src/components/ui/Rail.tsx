"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Horizontal, snap-scrolling row with gold arrow controls. */
export function Rail({
  children,
  className,
  itemClassName = "w-[44%] sm:w-[30%] lg:w-[22%] xl:w-[18%]",
  label,
}: {
  children: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const arrow =
    "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-gold/40 bg-ink/90 text-gold shadow-lg backdrop-blur transition-all hover:bg-gold hover:text-ink md:grid disabled:pointer-events-none disabled:opacity-0";

  return (
    <div className={cn("group/rail relative", className)} role="region" aria-label={label}>
      <button type="button" aria-label="Scroll left" className={cn(arrow, "-left-4")} disabled={!canPrev} onClick={() => scroll(-1)}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div ref={ref} className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {children.map((child, i) => (
          <div key={i} className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </div>
        ))}
      </div>
      <button type="button" aria-label="Scroll right" className={cn(arrow, "-right-4")} disabled={!canNext} onClick={() => scroll(1)}>
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
