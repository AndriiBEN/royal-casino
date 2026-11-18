import "server-only";
import type { Metadata } from "next";
import { getCurrentUser } from "../auth";

/** Titles for admin pages. Non-admins get the generic not-found title, so the area isn't confirmed. */
export async function adminMetadata(title: string): Promise<Metadata> {
  const user = await getCurrentUser();
  return {
    title: user?.role === "ADMIN" ? `${title} · Admin` : "Page not found",
    robots: { index: false, follow: false },
  };
}
