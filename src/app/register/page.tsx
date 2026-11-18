import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/AuthForms";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Register", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const raw = (await searchParams).next;
  if (await getCurrentUser()) redirect(safeNext(raw, "/"));

  return (
    <AuthShell mode="register" title="Join the club" subtitle="Create your free account and start with 10,000 virtual credits.">
      <RegisterForm next={raw ? safeNext(raw) : undefined} />
    </AuthShell>
  );
}
