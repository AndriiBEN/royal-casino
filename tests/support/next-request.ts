/**
 * A fake Next.js request for testing server actions outside the framework:
 * a cookie jar, request headers, and redirect()/notFound() that throw inspectable errors.
 *
 * Use from a test file:
 *   vi.mock("next/headers", async () => (await import("./support/next-request")).headersModule);
 *   vi.mock("next/navigation", async () => (await import("./support/next-request")).navigationModule);
 *   vi.mock("next/cache", async () => (await import("./support/next-request")).cacheModule);
 */

type CookieOptions = { httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string; expires?: Date };
type StoredCookie = { name: string; value: string; options: CookieOptions };

export class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
export class NotFound extends Error {
  constructor() {
    super("notFound");
  }
}

/** One "browser": its cookies and the headers it sends. */
export class Browser {
  cookies = new Map<string, StoredCookie>();
  headers = new Map<string, string>([["user-agent", "vitest"]]);

  cookie(name: string) {
    return this.cookies.get(name)?.value;
  }
}

export const request = { browser: new Browser() };

/** Switches the active browser (e.g. to simulate a second device or an attacker). */
export function use(b: Browser) {
  request.browser = b;
  return b;
}

const jar = {
  get: (name: string) => {
    const c = request.browser.cookies.get(name);
    return c ? { name, value: c.value } : undefined;
  },
  set: (name: string, value: string, options: CookieOptions = {}) => {
    request.browser.cookies.set(name, { name, value, options });
  },
  delete: (name: string) => {
    request.browser.cookies.delete(name);
  },
};

export const headersModule = {
  cookies: async () => jar,
  headers: async () => ({ get: (k: string) => request.browser.headers.get(k.toLowerCase()) ?? null }),
};

export const navigationModule = {
  redirect: (url: string) => {
    throw new Redirect(url);
  },
  notFound: () => {
    throw new NotFound();
  },
};

export const cacheModule = { revalidatePath: () => {}, revalidateTag: () => {} };

/** Runs a server action and reports where it redirected (or the state it returned). */
export async function run<T>(p: Promise<T>): Promise<{ redirect?: string; notFound?: true; state?: T }> {
  try {
    return { state: await p };
  } catch (e) {
    if (e instanceof Redirect) return { redirect: e.url };
    if (e instanceof NotFound) return { notFound: true };
    throw e;
  }
}

export function form(fields: Record<string, string | number | boolean>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, String(v));
  return f;
}
