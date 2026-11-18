import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Gold gradient hairline border instead of the default subtle line. */
  gilded?: boolean;
  interactive?: boolean;
};

export function Card({ className, gilded, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl bg-surface shadow-card",
        gilded ? "border-gold-gradient" : "border border-line",
        interactive &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-gold",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-4 p-6 pb-0", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}
