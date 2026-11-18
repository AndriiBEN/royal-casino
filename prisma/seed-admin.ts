/**
 * Development-only admin seed: `npm run db:seed:admin`
 *
 * Creates (or promotes and re-keys) one ADMIN account from server-side environment
 * variables. Credentials are read from .env / the shell only and are never written to
 * source code or anything bundled for the browser.
 *
 *   ADMIN_USERNAME  default "admin"
 *   ADMIN_EMAIL     default "admin@royal.local"
 *   ADMIN_PASSWORD  if empty, a strong random password is generated and printed ONCE
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { passwordRule } from "../src/lib/validations";
import { SIGNUP_CREDITS } from "../src/lib/constants";

// Load .env without overriding variables already set in the shell (Node 20.12+).
try {
  const shell = { ...process.env };
  process.loadEnvFile(".env");
  Object.assign(process.env, shell);
} catch {
  /* no .env file: rely on the shell environment */
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  fail("Refusing to run: db:seed:admin is a development-only tool (NODE_ENV=production).");
}

const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const email = (process.env.ADMIN_EMAIL || "admin@royal.local").trim().toLowerCase();
const provided = process.env.ADMIN_PASSWORD ?? "";

if (!/^[a-z0-9_]{3,20}$/.test(username)) fail("ADMIN_USERNAME must be 3–20 characters of a-z, 0-9 or _.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("ADMIN_EMAIL is not a valid email address.");

let password = provided;
let generated = false;
if (!password) {
  // 24 random bytes -> 32 base64url chars; append a digit-letter pair to satisfy the policy deterministically.
  password = `${randomBytes(24).toString("base64url")}9a`;
  generated = true;
} else {
  const check = passwordRule.safeParse(password);
  if (!check.success) fail(`ADMIN_PASSWORD does not meet the password policy: ${check.error.issues[0].message}`);
  if (password.toLowerCase().includes(username)) fail("ADMIN_PASSWORD must not contain the username.");
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });

  if (existing) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", passwordHash, passwordChangedAt: new Date(), email },
      }),
      // A new password invalidates every existing session for this account.
      prisma.session.deleteMany({ where: { userId: existing.id } }),
    ]);
    const wallet = await prisma.wallet.findUnique({ where: { userId: existing.id } });
    if (!wallet) {
      await prisma.wallet.create({
        data: {
          userId: existing.id,
          balance: SIGNUP_CREDITS,
          transactions: { create: { type: "signup", amount: SIGNUP_CREDITS, balanceAfter: SIGNUP_CREDITS } },
        },
      });
    }
    console.log(`\n✔ Updated "${existing.username}": role ADMIN, password reset, sessions revoked.`);
  } else {
    await prisma.user.create({
      data: {
        username,
        email,
        displayName: "House Admin",
        passwordHash,
        role: "ADMIN",
        wallet: {
          create: {
            balance: SIGNUP_CREDITS,
            transactions: { create: { type: "signup", amount: SIGNUP_CREDITS, balanceAfter: SIGNUP_CREDITS } },
          },
        },
      },
    });
    console.log(`\n✔ Created admin account "${username}" <${email}>.`);
  }

  // Record what this script did: the role grant, and the signup credits if it opened a wallet.
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: existing?.username ?? username }, include: { wallet: true } });
  await prisma.auditLog.create({
    data: {
      action: "admin.role_change",
      targetUserId: admin.id,
      ip: "seed-admin",
      details: JSON.stringify({ target: admin.username, from: existing?.role ?? "none", to: "ADMIN", via: "npm run db:seed:admin" }),
    },
  });
  if (admin.wallet) {
    const signups = await prisma.transaction.findMany({
      where: { walletId: admin.wallet.id, status: "completed", type: "signup" },
      select: { id: true, amount: true, balanceAfter: true },
    });
    for (const t of signups) {
      if (await prisma.auditLog.count({ where: { transactionId: t.id } })) continue;
      await prisma.auditLog.create({
        data: { action: "wallet.signup_credits", walletId: admin.wallet.id, transactionId: t.id, amount: t.amount, balanceBefore: 0, balanceAfter: t.balanceAfter, ip: "seed-admin" },
      });
    }
  }

  if (generated) {
    console.log("\n  Generated password (shown once, not stored anywhere in plain text):");
    console.log(`\n      ${password}\n`);
    console.log("  Store it in a password manager, or set ADMIN_PASSWORD in .env and re-run to choose your own.\n");
  } else {
    console.log("  Password taken from ADMIN_PASSWORD.\n");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
