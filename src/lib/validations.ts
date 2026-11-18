import { z } from "zod";
import { CATEGORY_SLUGS, SORT_OPTIONS } from "./constants";
import { CURRENCY_CODES, DEPOSIT_CURRENCIES } from "./wallet/currencies";
import { AVATARS } from "./avatars";
import { DEPOSIT_MAX, DEPOSIT_MIN, TX_STATUSES, TX_TYPES } from "./wallet/limits";

/** Client-generated request id used for duplicate-transaction protection. */
export const requestIdSchema = z.uuid({ message: "This form has expired. Reload the page and try again." });


const sortValues = SORT_OPTIONS.map((s) => s.value) as [
  (typeof SORT_OPTIONS)[number]["value"],
  ...(typeof SORT_OPTIONS)[number]["value"][],
];

/** Parses /games search params. Invalid values fall back to defaults instead of throwing. */
export const gameFiltersSchema = z.object({
  category: z.enum(CATEGORY_SLUGS).optional().catch(undefined),
  q: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v : undefined))
    .catch(undefined),
  sort: z.enum(sortValues).default("popular").catch("popular"),
  favorites: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true")
    .catch(false),
});

export type GameFilters = z.infer<typeof gameFiltersSchema>;

export function parseGameFilters(raw: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  return gameFiltersSchema.parse(flat);
}

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters.")
  .max(20, "Username must be 20 characters or fewer.")
  .regex(/^[a-z0-9_]+$/, "Use only letters, numbers and underscores.");

/** Names that could be mistaken for staff accounts. */
const RESERVED = new Set(["admin", "administrator", "root", "system", "support", "staff", "moderator", "royal", "royalcasino", "casino", "security", "help"]);

const newUsername = username.refine((u) => !RESERVED.has(u), "That username is reserved.");

const displayName = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters.")
  .max(32, "Display name must be 32 characters or fewer.")
  .regex(/^[\p{L}\p{N} ._'-]+$/u, "Use letters, numbers, spaces and . _ ' - only.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email address is too long.")
  .pipe(z.email("Enter a valid email address."));

/** At least 10 characters, with a letter and a number. Argon2 handles long inputs; 128 is a sanity cap. */
export const passwordRule = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/[0-9]/, "Password must include a number.");

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Enter your username or email.")
    .max(254),
  password: z.string().min(1, "Enter your password.").max(128),
});

export const registerSchema = z
  .object({
    username: newUsername,
    email,
    displayName,
    password: passwordRule,
    confirm: z.string().max(128),
    adult: z.literal("on", { message: "You must confirm you are 18 or older." }),
  })
  .superRefine((d, ctx) => {
    if (d.password !== d.confirm) ctx.addIssue({ code: "custom", message: "Passwords do not match.", path: ["confirm"] });
    if (d.password.toLowerCase().includes(d.username))
      ctx.addIssue({ code: "custom", message: "Password must not contain your username.", path: ["password"] });
  });

export const profileSchema = z.object({ displayName, email });

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Enter your current password.").max(128),
    password: passwordRule,
    confirm: z.string().max(128),
  })
  .superRefine((d, ctx) => {
    if (d.password !== d.confirm) ctx.addIssue({ code: "custom", message: "Passwords do not match.", path: ["confirm"] });
    if (d.password === d.current)
      ctx.addIssue({ code: "custom", message: "Choose a password you have not used here.", path: ["password"] });
  });

/* Admin */
export const adminRoleSchema = z.object({
  userId: z.string().min(1).max(40),
  role: z.enum(["USER", "ADMIN"]),
});

export const adminAdjustSchema = z.object({
  userId: z.string().min(1).max(40),
  /** whole credits, positive or negative */
  credits: z.coerce
    .number({ message: "Enter an amount." })
    .int("Use whole credits.")
    .min(-1_000_000, "Too large.")
    .max(1_000_000, "Too large.")
    .refine((n) => n !== 0, "Amount cannot be zero."),
  note: z.string().trim().min(3, "Add a short reason.").max(120),
  requestId: requestIdSchema,
});

/* ------------------------------------------------------------------ */
/* Wallet (DEMO). Note: no schema accepts a balance from the browser.  */
/* ------------------------------------------------------------------ */

export const depositSchema = z.object({
  currency: z.enum(DEPOSIT_CURRENCIES, { message: "Choose a demo currency." }),
  /** whole credits */
  credits: z.coerce
    .number({ message: "Enter an amount." })
    .int("Use whole credits.")
    .min(DEPOSIT_MIN / 100, `Minimum demo deposit is ${(DEPOSIT_MIN / 100).toLocaleString("en-US")} credits.`)
    .max(DEPOSIT_MAX / 100, `Maximum demo deposit is ${(DEPOSIT_MAX / 100).toLocaleString("en-US")} credits.`),
  requestId: requestIdSchema,
});

export const depositActionSchema = z.object({
  transactionId: z.string().min(1).max(40),
});

export const displayCurrencySchema = z.object({ currency: z.enum(CURRENCY_CODES) });

export const historyFilterSchema = z.object({
  type: z.enum(TX_TYPES).optional().catch(undefined),
  status: z.enum(TX_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

/** Flattens Zod issues into { field: firstMessage } for form display. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export const avatarSchema = z.object({ avatar: z.enum(AVATARS.map((a) => a.id) as [string, ...string[]]) });

export const historyQuerySchema = z.object({
  engine: z.enum(["slots", "blackjack", "roulette", "holdem"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const toggleFavoriteSchema = z.object({
  gameId: z.string().min(1).max(40),
});

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
