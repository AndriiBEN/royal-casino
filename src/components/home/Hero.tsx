"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Crown, Play, ShieldCheck, Sparkles, UserPlus, Users, Wallet } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { GameArt } from "@/components/games/GameArt";
import { formatNumber } from "@/lib/utils";

type HeroGame = { slug: string; name: string; icon: string; palette: string; studio: string; engine: string };

const ease = [0.22, 1, 0.36, 1] as const;

/** Floating gold particles behind the hero copy. Positions are fixed so server and client markup match. */
const PARTICLES = [
  [8, 22, 3, 0], [18, 70, 2, 1.2], [30, 12, 2, 2.1], [44, 82, 3, 0.6], [52, 30, 2, 1.8],
  [63, 64, 2, 0.3], [72, 18, 3, 2.6], [81, 76, 2, 1.1], [90, 40, 3, 0.9], [96, 10, 2, 2.2],
] as const;

export function Hero({
  games,
  playersOnline,
  signedIn,
}: {
  games: HeroGame[];
  playersOnline: number;
  signedIn: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fanY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 80]);
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);
  const fan = games.slice(0, 3);
  const spotlight = fan[1] ?? fan[0];

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden rounded-[2rem] border border-gold/25 bg-surface shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]"
    >
      {/* Backdrop */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <motion.div
          style={{ opacity: glowOpacity }}
          className="absolute inset-0 bg-[radial-gradient(80%_120%_at_85%_0%,rgb(212_175_98/0.26),transparent_55%)]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_0%_100%,rgb(184_149_80/0.14),transparent_60%)]" />
        <div className="bg-pattern-deco absolute inset-0 opacity-50 [mask-image:linear-gradient(90deg,black,transparent_75%)]" />
        {/* deco sunrise */}
        <div
          className="absolute -bottom-1/2 right-[-10%] aspect-square w-[70%] opacity-[0.13]"
          style={{
            background: "repeating-conic-gradient(from -90deg at 50% 50%, #D4AF62 0deg 1.5deg, transparent 1.5deg 9deg)",
            maskImage: "radial-gradient(circle, black 0%, transparent 65%)",
            WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 65%)",
          }}
        />
        {PARTICLES.map(([x, y, s, d], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-gold-light"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: s,
              height: s,
              boxShadow: "0 0 10px 2px rgb(241 217 155 / 0.6)",
              animation: reduce ? undefined : `float-particle 6s ease-in-out ${d}s infinite`,
            }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </div>

      <div className="grid items-center gap-10 px-6 py-12 sm:px-10 md:py-16 lg:grid-cols-[1.15fr_1fr] lg:px-14 xl:py-24">
        <div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-ink/50 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-gold-light backdrop-blur"
          >
            <Crown className="h-3.5 w-3.5 text-gold" />
            The house of gold
          </motion.div>

          <h1 className="mt-6 font-display font-bold uppercase leading-[0.86] tracking-[0.02em]">
            <motion.span
              initial={reduce ? false : { opacity: 0, y: 30, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.05, ease }}
              className="block text-[3.4rem] text-ivory sm:text-7xl xl:text-[5.6rem]"
            >
              Play like
            </motion.span>
            <motion.span
              initial={reduce ? false : { opacity: 0, y: 30, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.18, ease }}
              className="block animate-shimmer text-[3.4rem] text-gold-gradient drop-shadow-[0_4px_30px_rgb(212_175_98/0.35)] sm:text-7xl xl:text-[5.6rem]"
            >
              Royalty
            </motion.span>
          </h1>

          <motion.div
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 0.35, ease }}
            className="mt-6 h-px w-40 origin-left bg-gradient-to-r from-gold to-transparent"
          />

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease }}
            className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg"
          >
            Original slots, live salon tables and progressive jackpots, played with virtual credits.{" "}
            {signedIn ? (
              <>Your table is ready.</>
            ) : (
              <>
                Join today and receive <span className="font-semibold text-gold-light">10,000 credits</span> on
                the house.
              </>
            )}
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.42, ease }}
            className="mt-9 flex flex-wrap gap-3"
          >
            {spotlight && (
              <ButtonLink href={`/games/${spotlight.slug}/play`} size="lg">
                <Play className="h-4 w-4 fill-current" />
                Play {spotlight.name}
              </ButtonLink>
            )}
            {signedIn ? (
              <ButtonLink href="/wallet" variant="outline" size="lg">
                <Wallet className="h-4 w-4" />
                My wallet
              </ButtonLink>
            ) : (
              <ButtonLink href="/register" variant="outline" size="lg">
                <UserPlus className="h-4 w-4" />
                Join the club
              </ButtonLink>
            )}
          </motion.div>

          <motion.ul
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted"
          >
            <li className="flex items-center gap-2">
              <Users className="h-4 w-4 text-jade" />
              <span>
                <b className="font-bold text-ivory">{formatNumber(playersOnline)}</b> playing now
              </span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold" />
              Crypto-grade RNG
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              Virtual credits only
            </li>
          </motion.ul>
        </div>

        {/* Fanned game cards */}
        <motion.div style={{ y: fanY }} className="relative mx-auto hidden h-[27rem] w-full max-w-md sm:block">
          {fan.map((g, i) => {
            const rotate = [-12, 0, 12][i];
            const offset = ["-30%", "0%", "30%"][i];
            return (
              <div
                key={g.slug}
                className="absolute left-1/2 top-1/2 w-52 -translate-x-1/2 -translate-y-1/2 xl:w-60"
                style={{ zIndex: i === 1 ? 3 : 1, marginLeft: offset }}
              >
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 80, rotate: 0 }}
                  animate={{ opacity: 1, y: i === 1 ? -14 : 8, rotate }}
                  whileHover={reduce ? undefined : { y: i === 1 ? -30 : -8, scale: 1.04 }}
                  transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.3 + i * 0.12 }}
                >
                  <Link
                    href={`/games/${g.slug}`}
                    aria-label={g.name}
                    className="group block aspect-[3/4] overflow-hidden rounded-2xl border border-gold/40 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.95)]"
                  >
                    <GameArt name={g.name} icon={g.icon} palette={g.palette} engine={g.engine} />
                  </Link>
                </motion.div>
              </div>
            );
          })}
          <div aria-hidden className="absolute bottom-0 left-1/2 h-10 w-3/4 -translate-x-1/2 rounded-[50%] bg-gold/25 blur-2xl" />
        </motion.div>
      </div>
    </section>
  );
}
