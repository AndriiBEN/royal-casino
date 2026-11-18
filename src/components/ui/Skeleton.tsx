import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-xl bg-[linear-gradient(90deg,#151515_0%,#232326_50%,#151515_100%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}
