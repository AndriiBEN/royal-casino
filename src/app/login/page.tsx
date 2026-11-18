import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { DEMO_LOGIN } from "@/lib/constants";

export const metadata: Metadata = { title: "Login", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next, "/");
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthShell
      mode="login"
      title="Welcome back"
      subtitle={next !== "/" ? "Please log in to continue to that page." : "Log in to your Royal Casino account."}
    >
      <LoginForm next={next} />
      {/* Demo USER account (never an admin), shown only in development builds. */}
      {process.env.NODE_ENV !== "production" && (
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-dashed border-gold/30 bg-gold/5 p-4 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p className="text-muted">
            <span className="font-semibold text-gold-light">Development demo account:</span>{" "}
            <span className="font-semibold text-ivory">{DEMO_LOGIN.username}</span> /{" "}
            <span className="font-semibold text-ivory">{DEMO_LOGIN.password}</span>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
