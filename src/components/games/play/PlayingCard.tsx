"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { playSound } from "@/lib/sound";
import { Crown } from "lucide-react";
import type { Card } from "@/lib/games/cards";
import { cn } from "@/lib/utils";

const SUIT: Record<string, { glyph: string; red: boolean; name: string }> = {
  s: { glyph: "♠", red: false, name: "spades" },
  h: { glyph: "♥", red: true, name: "hearts" },
  d: { glyph: "♦", red: true, name: "diamonds" },
  c: { glyph: "♣", red: false, name: "clubs" },
};
const RANK_LABEL: Record<string, string> = { T: "10", J: "J", Q: "Q", K: "K", A: "A" };
const RANK_NAME: Record<string, string> = { T: "10", J: "Jack", Q: "Queen", K: "King", A: "Ace" };

export function cardLabel(c: Card) {
  return `${RANK_NAME[c[0]] ?? c[0]} of ${SUIT[c[1]].name}`;
}

const SIZES = {
  sm: { box: "h-[4.2rem] w-12", face: "rounded-md text-sm" },
  md: { box: "h-[5.6rem] w-16 sm:h-[6.6rem] sm:w-[4.7rem]", face: "rounded-lg text-lg sm:text-xl" },
  lg: { box: "h-[6.6rem] w-[4.7rem] sm:h-32 sm:w-[5.6rem]", face: "rounded-lg text-xl sm:text-2xl" },
};

/**
 * A playing card that deals in and flips. `card === null` renders the back (a hidden
 * card: the client never knows what it is until the server reveals it).
 */
export function PlayingCard({
  card,
  size = "md",
  delay = 0,
  highlight = false,
  dim = false,
  from = { x: 0, y: -60 },
}: {
  card: Card | null;
  size?: keyof typeof SIZES;
  delay?: number;
  highlight?: boolean;
  dim?: boolean;
  from?: { x: number; y: number };
}) {
  const reduce = useReducedMotion();
  const faceUp = card !== null;
  // The swish of the card leaving the shoe, timed with its deal animation.
  useEffect(() => {
    const t = setTimeout(() => playSound("card"), reduce ? 0 : delay * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: from.x, y: from.y, rotate: -8, scale: 0.9 }}
      animate={{ opacity: dim ? 0.45 : 1, x: 0, y: highlight ? -6 : 0, rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay }}
      className={cn("relative shrink-0 [perspective:800px]", SIZES[size].box)}
      role="img"
      aria-label={faceUp ? cardLabel(card) : "Face-down card"}
    >
      <motion.div
        initial={false}
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={{ duration: reduce ? 0 : 0.45, delay: reduce ? 0 : delay + 0.05 }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        {/* Face */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-between border bg-[linear-gradient(160deg,#fbf7ee,#efe6d2)] p-1.5 font-bold shadow-[0_8px_18px_-6px_rgb(0_0_0/0.8)] [backface-visibility:hidden]",
            SIZES[size].face,
            highlight ? "border-gold ring-2 ring-gold shadow-[0_0_22px_rgb(212_175_98/0.7)]" : "border-black/10",
          )}
        >
          {card && (
            <>
              <span className={cn("leading-none", SUIT[card[1]].red ? "text-[#b3122a]" : "text-[#16161a]")}>
                {RANK_LABEL[card[0]] ?? card[0]}
                <span className="block text-[0.8em]">{SUIT[card[1]].glyph}</span>
              </span>
              <span className={cn("self-center text-[1.9em] leading-none", SUIT[card[1]].red ? "text-[#b3122a]" : "text-[#16161a]")}>
                {SUIT[card[1]].glyph}
              </span>
              <span className={cn("rotate-180 leading-none", SUIT[card[1]].red ? "text-[#b3122a]" : "text-[#16161a]")}>
                {RANK_LABEL[card[0]] ?? card[0]}
              </span>
            </>
          )}
        </div>
        {/* Back */}
        <div
          className={cn(
            "absolute inset-0 grid place-items-center border border-gold/60 bg-[repeating-linear-gradient(45deg,#151515_0_6px,#1d1a12_6px_12px)] shadow-[0_8px_18px_-6px_rgb(0_0_0/0.8)] [backface-visibility:hidden] [transform:rotateY(180deg)]",
            SIZES[size].face,
          )}
        >
          <span className="grid h-3/5 w-3/5 place-items-center rounded-md border border-gold/50 bg-ink/80">
            <Crown className="h-1/2 w-1/2 text-gold" />
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
