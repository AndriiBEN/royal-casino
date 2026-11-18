import { NextResponse, type NextRequest } from "next/server";

/**
 * First line of defence for protected routes: requests without a session cookie are
 * redirected to /login before any page code runs. This only checks that a cookie is
 * present. Every protected page and server action still validates the session (and
 * role) against the database via requireUser() / requireAdmin().
 */
const PROTECTED = [/^\/wallet(\/|$)/, /^\/profile(\/|$)/, /^\/admin(\/|$)/, /^\/games\/[^/]+\/play\/?$/];
const COOKIES = ["__Host-rc_session", "rc_session"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();

  const hasSession = COOKIES.some((name) => req.cookies.get(name)?.value);
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/wallet/:path*", "/profile/:path*", "/admin/:path*", "/games/:slug/play"],
};
