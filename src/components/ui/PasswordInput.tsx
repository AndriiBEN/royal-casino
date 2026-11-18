"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "./Input";
import { cn } from "@/lib/utils";

/** Password input with a show/hide toggle and an optional strength meter. */
export function PasswordInput({
  id,
  name,
  autoComplete,
  invalid,
  meter = false,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  meter?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const score = strength(value);

  return (
    <div>
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        maxLength={128}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        icon={<Lock className="h-4 w-4" />}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${name}-error` : meter ? `${name}-hint` : undefined}
        className={cn("rounded-xl", invalid && "border-ruby/60")}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:text-gold"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      {meter && value && (
        <div className="mt-2 flex items-center gap-2" aria-hidden>
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  i < score ? ["bg-ruby", "bg-[#e0a24a]", "bg-gold", "bg-jade"][score - 1] : "bg-surface-3",
                )}
              />
            ))}
          </div>
          <span className="w-16 text-right text-[0.65rem] font-semibold text-muted">
            {["Too weak", "Weak", "Good", "Strong"][Math.max(0, score - 1)]}
          </span>
        </div>
      )}
    </div>
  );
}

/** Rough 1–4 score for feedback only. The server enforces the actual policy. */
function strength(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length < 10 || !/\d/.test(pw) || !/[A-Za-z]/.test(pw)) s = Math.min(s, 1);
  return Math.max(1, Math.min(4, s));
}
