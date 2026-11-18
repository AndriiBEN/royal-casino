import Link from "next/link";
import { Check, Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

const PERKS = [
  "10,000 virtual credits on joining",
  "Daily bonus of 1,000 credits",
  "Crown Points and five VIP tiers",
  "Favourites saved to your account",
];

const TRUST = [
  { icon: Fingerprint, label: "Argon2id hashing" },
  { icon: Lock, label: "HttpOnly sessions" },
  { icon: ShieldCheck, label: "Rate limited" },
];

/** Split layout shared by the login and register pages. */
export function AuthShell({
  mode,
  title,
  subtitle,
  children,
}: {
  mode: "login" | "register";
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shell-container py-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl grid-cols-1 overflow-hidden rounded-[2rem] border-gold-gradient shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)] lg:grid-cols-[1fr_1.2fr]">
        {/* Showcase panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_0%,rgb(212_175_98/0.25),transparent_60%),linear-gradient(160deg,#1b1b1d,#0b0b0d)]" />
          <div aria-hidden className="bg-pattern-deco absolute inset-0 opacity-60" />
          <div
            aria-hidden
            className="absolute -bottom-40 -right-40 aspect-square w-[34rem] animate-[spin_120s_linear_infinite] opacity-20"
            style={{
              background: "repeating-conic-gradient(from 0deg, #D4AF62 0deg 2deg, transparent 2deg 10deg)",
              maskImage: "radial-gradient(circle, black 0%, transparent 65%)",
              WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 65%)",
            }}
          />
          <div className="relative">
            <LogoMark className="h-14 w-14" />
            <h2 className="mt-8 font-display text-5xl font-bold uppercase leading-[0.9] text-ivory">
              Play like <span className="block text-gold-gradient">royalty</span>
            </h2>
            <p className="mt-4 max-w-xs text-sm text-muted">
              {mode === "login" ? "Your table, your balance and your VIP status are waiting." : "Membership takes less than a minute."}
            </p>
          </div>
          <div className="relative space-y-8">
            <ul className="space-y-3">
              {PERKS.map((p) => (
                <li key={p} className="flex items-center gap-3 text-sm text-ivory/85">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/40">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-2">
              {TRUST.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink/60 px-3 py-1.5 text-[0.7rem] text-muted">
                  <Icon className="h-3.5 w-3.5 text-gold" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Form panel */}
        <div className="min-w-0 bg-surface p-6 sm:p-10">
          {/* Login / Register switch */}
          <nav aria-label="Account" className="mb-8 grid grid-cols-2 rounded-full border border-line bg-ink p-1 text-sm font-semibold">
            {(["login", "register"] as const).map((m) => (
              <Link
                key={m}
                href={`/${m}`}
                aria-current={mode === m ? "page" : undefined}
                className={cn(
                  "rounded-full py-2.5 text-center transition-all",
                  mode === m ? "bg-gold-gradient text-ink shadow-[0_6px_20px_-8px_rgb(212_175_98/0.8)]" : "text-muted hover:text-ivory",
                )}
              >
                {m === "login" ? "Login" : "Register"}
              </Link>
            ))}
          </nav>
          <h1 className="text-4xl text-ivory">{title}</h1>
          <p className="mt-2 mb-8 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
