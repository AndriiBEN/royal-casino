import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "gold" | "outline" | "ghost" | "dark";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full font-semibold tracking-wide transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]";

const variants: Record<Variant, string> = {
  gold:
    "bg-gold-gradient text-ink shadow-[0_8px_30px_-8px_rgb(212_175_98/0.6)] hover:shadow-[0_10px_40px_-6px_rgb(212_175_98/0.8)] hover:brightness-110",
  outline:
    "border border-gold/40 text-gold-light hover:border-gold hover:bg-gold/10 hover:text-gold-light",
  ghost: "text-muted hover:bg-white/5 hover:text-ivory",
  dark: "border border-line bg-surface-2 text-ivory hover:border-gold/40 hover:bg-surface-3",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-13 px-8 text-[0.95rem]",
  icon: "h-10 w-10",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

/** Shine sweep shown on hover for the gold variant. */
function Shine({ variant }: { variant: Variant }) {
  if (variant !== "gold") return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent transition-all duration-700 group-hover/btn:left-[150%]"
    />
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  CommonProps & ButtonHTMLAttributes<HTMLButtonElement>
>(function Button({ variant = "gold", size = "md", className, children, ...props }, ref) {
  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      <Shine variant={variant} />
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "gold",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & { href: string; "aria-label"?: string }) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      <Shine variant={variant} />
      {children}
    </Link>
  );
}
