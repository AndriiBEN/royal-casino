import { AlertCircle, CheckCircle2 } from "lucide-react";

/** Labelled form field with an inline error or hint, wired for screen readers. */
export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-xs text-[#ff9aa2]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1.5 text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-center gap-2 rounded-xl border border-ruby/40 bg-ruby/10 px-4 py-3 text-sm text-[#ff9aa2]">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-[#8ff0c2]">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}
