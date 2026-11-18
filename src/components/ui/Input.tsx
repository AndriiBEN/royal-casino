import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
  trailing?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, icon, trailing, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2.5 rounded-full border border-line bg-surface-2/80 px-4 text-sm transition-colors focus-within:border-gold/60 focus-within:bg-surface-2",
        className,
      )}
    >
      {icon && <span className="shrink-0 text-subtle">{icon}</span>}
      <input
        ref={ref}
        className="h-full w-full min-w-0 bg-transparent text-ivory placeholder:text-subtle focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {trailing}
    </div>
  );
});
