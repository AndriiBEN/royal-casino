import { useId, type CSSProperties } from "react";
import { Sparkles, type LucideIcon } from "lucide-react";
import { GAME_ICONS, PALETTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Stable small hash so every game gets the same artwork on every render. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Motif = (glow: string) => CSSProperties;

/** Background motifs. Each game picks one from its name, combined with its own palette. */
const MOTIFS: Motif[] = [
  (g) => ({ background: `repeating-conic-gradient(from 0deg, ${g} 0deg 4deg, transparent 4deg 15deg)`, maskImage: "radial-gradient(circle, black 0%, transparent 62%)" }),
  (g) => ({ background: `repeating-radial-gradient(circle, ${g} 0 1.5px, transparent 1.5px 16px)`, maskImage: "radial-gradient(circle, black 10%, transparent 65%)" }),
  (g) => ({ background: `repeating-conic-gradient(from -70deg at 50% 100%, ${g} 0deg 2deg, transparent 2deg 9deg)`, maskImage: "linear-gradient(to top, black 20%, transparent 85%)" }),
  (g) => ({ background: `repeating-linear-gradient(45deg, ${g} 0 1px, transparent 1px 18px), repeating-linear-gradient(-45deg, ${g} 0 1px, transparent 1px 18px)`, maskImage: "radial-gradient(circle, black 15%, transparent 70%)" }),
  (g) => ({ background: `repeating-radial-gradient(circle at 50% 115%, ${g} 0 2px, transparent 2px 20px)`, maskImage: "linear-gradient(to top, black 30%, transparent 90%)" }),
  (g) => ({ background: `radial-gradient(${g} 1.2px, transparent 1.8px) 0 0 / 22px 22px, radial-gradient(${g} 0.8px, transparent 1.2px) 11px 11px / 22px 22px`, maskImage: "radial-gradient(circle, black 20%, transparent 70%)" }),
];

/* ------------------------------------------------------------------ */
/* Scenes: each game type gets an object from its own table            */
/* ------------------------------------------------------------------ */

const INK = "#0b0b0d";

/**
 * Gradient ids are unique per artwork: a gradient defined inside an SVG that is hidden
 * (display:none, e.g. the hero cards on phones) cannot be referenced by any other SVG.
 */
type Ids = { gold: string; card: string; glass: string };
const url = (id: string) => `url(#${id})`;

function Defs({ glow, ids }: { glow: string; ids: Ids }) {
  return (
    <defs>
      <linearGradient id={ids.gold} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff1c8" />
        <stop offset="0.35" stopColor="#f1d99b" />
        <stop offset="0.6" stopColor="#d4af62" />
        <stop offset="1" stopColor="#8a6a2f" />
      </linearGradient>
      <linearGradient id={ids.card} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fbf6ea" />
        <stop offset="1" stopColor="#e6dcc4" />
      </linearGradient>
      <radialGradient id={ids.glass} cx="0.5" cy="0.35" r="0.7">
        <stop offset="0" stopColor={glow} stopOpacity="0.25" />
        <stop offset="1" stopColor={INK} stopOpacity="0.9" />
      </radialGradient>
    </defs>
  );
}

/** A casino chip: solid disc, dashed edge inlays, gold rim. */
function Chip({ x, y, r, fill, ids }: { x: number; y: number; r: number; fill: string; ids: Ids }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} stroke={url(ids.gold)} strokeWidth={0.8} />
      <circle cx={x} cy={y} r={r - 1.6} fill="none" stroke="#fbf6ea" strokeWidth={1.8} strokeDasharray={`${r * 0.5} ${r * 0.62}`} opacity={0.85} />
      <circle cx={x} cy={y} r={r * 0.52} fill="none" stroke={url(ids.gold)} strokeWidth={0.6} />
    </g>
  );
}

/** A playing card face with a corner index and a large centre pip. */
function Card({ x, y, rotate, rank, suit, red, ids }: { x: number; y: number; rotate: number; rank: string; suit: string; red: boolean; ids: Ids }) {
  const ink = red ? "#a3202e" : "#17171b";
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x={-17} y={-24} width={34} height={48} rx={3.5} fill={url(ids.card)} stroke={url(ids.gold)} strokeWidth={0.9} />
      <rect x={-14.5} y={-21.5} width={29} height={43} rx={2.2} fill="none" stroke={ink} strokeOpacity={0.15} strokeWidth={0.5} />
      <text x={-12.5} y={-13.5} fontSize={8} fontWeight={700} fill={ink} fontFamily="var(--font-display), Georgia, serif">{rank}</text>
      <text x={-12.2} y={-6} fontSize={6} fill={ink}>{suit}</text>
      <text x={0} y={7} fontSize={20} fill={ink} textAnchor="middle">{suit}</text>
      <text x={12.5} y={18.5} fontSize={8} fontWeight={700} fill={ink} textAnchor="end" transform="rotate(180 9.5 15.5)" fontFamily="var(--font-display), Georgia, serif">{rank}</text>
    </g>
  );
}

function SlotsScene({ Icon, ids }: { Icon: LucideIcon; ids: Ids }) {
  const reels = [22, 48, 74];
  const side = ["7", "♦", "♣", "♥", "♠", "7"];
  return (
    <>
      <rect x={10} y={20} width={80} height={60} rx={9} fill={url(ids.glass)} stroke={url(ids.gold)} strokeWidth={1.2} />
      {reels.map((cx, i) => (
        <g key={cx}>
          <rect x={cx - 11} y={26} width={22} height={48} rx={4} fill={INK} fillOpacity={0.72} stroke={url(ids.gold)} strokeOpacity={0.45} strokeWidth={0.6} />
          <text x={cx} y={37} fontSize={8} textAnchor="middle" fill="#f1d99b" opacity={0.35}>{side[i]}</text>
          <text x={cx} y={70} fontSize={8} textAnchor="middle" fill="#f1d99b" opacity={0.35}>{side[i + 3]}</text>
          <Icon x={cx - 7.5} y={42.5} width={15} height={15} stroke={url(ids.gold)} strokeWidth={1.6} />
        </g>
      ))}
      {/* payline */}
      <line x1={8} y1={50} x2={92} y2={50} stroke={url(ids.gold)} strokeWidth={0.7} strokeDasharray="2 2" opacity={0.8} />
      <path d="M5 46.5 L9.5 50 L5 53.5Z M95 46.5 L90.5 50 L95 53.5Z" fill={url(ids.gold)} />
      {/* marquee lights */}
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={i} cx={18 + i * 8} cy={15} r={1.1} fill="#fff1c8" opacity={i % 2 ? 0.45 : 0.95} />
      ))}
    </>
  );
}

const POCKETS = 37;
function wedge(i: number, r1: number, r2: number) {
  const a0 = (i / POCKETS) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((i + 1) / POCKETS) * Math.PI * 2 - Math.PI / 2;
  const p = (r: number, a: number) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
  return `M${p(r1, a0)} L${p(r2, a0)} A${r2} ${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)}Z`;
}

function RouletteScene({ Icon, ids }: { Icon: LucideIcon; ids: Ids }) {
  return (
    <>
      <circle cx={50} cy={50} r={41} fill={INK} stroke={url(ids.gold)} strokeWidth={2.2} />
      <g className="origin-center transition-transform duration-[2500ms] ease-out group-hover:rotate-[160deg]" style={{ transformBox: "view-box" }}>
        {Array.from({ length: POCKETS }, (_, i) => (
          <path key={i} d={wedge(i, 24, 37.5)} fill={i === 0 ? "#137a4d" : i % 2 ? "#9b1f2d" : "#151518"} stroke={url(ids.gold)} strokeOpacity={0.55} strokeWidth={0.35} />
        ))}
        <circle cx={50} cy={50} r={24} fill={url(ids.glass)} stroke={url(ids.gold)} strokeWidth={0.9} />
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1={50} y1={31} x2={50} y2={69} stroke={url(ids.gold)} strokeWidth={0.9} transform={`rotate(${a} 50 50)`} opacity={0.6} />
        ))}
      </g>
      <circle cx={50} cy={50} r={9.5} fill={INK} stroke={url(ids.gold)} strokeWidth={1.1} />
      <Icon x={44} y={44} width={12} height={12} stroke={url(ids.gold)} strokeWidth={1.8} />
      {/* the ball, resting in a pocket */}
      <circle cx={63} cy={20.5} r={2.4} fill="#fbf6ea" />
      <circle cx={62.3} cy={19.8} r={0.8} fill="#fff" />
    </>
  );
}

function BlackjackScene({ ids }: { ids: Ids }) {
  return (
    <>
      <ellipse cx={50} cy={78} rx={34} ry={6} fill="#000" opacity={0.35} />
      <Card x={39} y={48} rotate={-12} rank="A" suit="♠" red={false} ids={ids} />
      <Card x={60} y={46} rotate={9} rank="K" suit="♥" red ids={ids} />
      <Chip x={77} y={76} r={9} fill="#121214" ids={ids} />
      <Chip x={77} y={72} r={9} fill="#9b1f2d" ids={ids} />
    </>
  );
}

function HoldemScene({ ids }: { ids: Ids }) {
  return (
    <>
      <ellipse cx={50} cy={80} rx={36} ry={6} fill="#000" opacity={0.35} />
      <Card x={34} y={47} rotate={-8} rank="A" suit="♦" red ids={ids} />
      <Card x={52} y={44} rotate={6} rank="A" suit="♣" red={false} ids={ids} />
      {[0, 1, 2, 3].map((k) => (
        <Chip key={k} x={77} y={78 - k * 4.2} r={9} fill={k % 2 ? "#0f6a45" : "#121214"} ids={ids} />
      ))}
      <Chip x={64} y={81} r={8} fill="#16367a" ids={ids} />
    </>
  );
}

/**
 * Procedural game artwork: palette gradient, motif, and an object from the game's table
 * (reels, wheel, cards and chips), drawn as vector art. No third-party art is used.
 */
export function GameArt({
  name,
  icon,
  palette,
  engine = "slots",
  studio,
  className,
  size = "md",
  showTitle = true,
}: {
  name: string;
  icon: string;
  palette: string;
  engine?: string;
  studio?: string;
  className?: string;
  size?: "md" | "lg";
  showTitle?: boolean;
}) {
  const p = PALETTES[palette] ?? PALETTES.obsidian;
  const Icon = GAME_ICONS[icon] ?? Sparkles;
  const h = hash(name);
  const motif = MOTIFS[h % MOTIFS.length](p.glow);
  const tilt = ((h >>> 8) % 50) + 140; // gradient angle 140–190deg
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids: Ids = { gold: `ga-gold-${uid}`, card: `ga-card-${uid}`, glass: `ga-glass-${uid}` };

  const scene =
    engine === "roulette" ? <RouletteScene Icon={Icon} ids={ids} /> : engine === "blackjack" ? <BlackjackScene ids={ids} /> : engine === "holdem" ? <HoldemScene ids={ids} /> : <SlotsScene Icon={Icon} ids={ids} />;

  return (
    <div
      className={cn("relative isolate h-full w-full overflow-hidden", className)}
      style={{ background: `linear-gradient(${tilt}deg, ${p.via} 0%, ${p.from} 45%, ${p.to} 100%)` }}
    >
      <div
        aria-hidden
        className="absolute left-1/2 top-[40%] -z-10 aspect-square w-[170%] -translate-x-1/2 -translate-y-1/2 opacity-[0.22] transition-transform duration-[1500ms] ease-out group-hover:rotate-[14deg] group-hover:scale-110"
        style={{ ...motif, WebkitMaskImage: motif.maskImage }}
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-[40%] -z-10 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-50"
        style={{ background: p.glow, opacity: 0.26 }}
      />
      <div aria-hidden className="absolute inset-2.5 rounded-xl border border-gold/25" />
      <div aria-hidden className="absolute inset-4 rounded-lg border border-gold/10" />
      {["left-3.5 top-3.5", "right-3.5 top-3.5", "left-3.5 bottom-3.5", "right-3.5 bottom-3.5"].map((pos) => (
        <span key={pos} aria-hidden className={cn("absolute h-1.5 w-1.5 rotate-45 bg-gold/50", pos)} />
      ))}

      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className={cn(
          "absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_18px_22px_rgb(0_0_0/0.55)] transition-transform duration-500 ease-out group-hover:scale-[1.06]",
          size === "lg" ? "w-[68%]" : "w-[78%]",
        )}
        style={{ filter: `drop-shadow(0 0 18px ${p.glow}55)` }}
      >
        <Defs glow={p.glow} ids={ids} />
        {scene}
      </svg>

      {showTitle && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-4 pb-4 pt-12 text-center">
          <p
            className={cn(
              "font-display font-bold uppercase leading-[0.95] tracking-[0.06em] text-gold-gradient drop-shadow",
              size === "lg" ? "text-4xl" : "text-[1.2rem]",
            )}
          >
            {name}
          </p>
          {studio && size === "lg" && <p className="mt-2 text-[0.7rem] font-semibold text-ivory/60">{studio}</p>}
        </div>
      )}
    </div>
  );
}
