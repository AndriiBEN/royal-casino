/**
 * Wallet service self-test. Run with: npm run test:wallet
 *
 * Creates a throwaway user, attacks the wallet service with concurrent and duplicate
 * requests, checks every invariant, then deletes the user. Uses the real service code
 * (run under the react-server condition so the "server-only" guard resolves).
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { atomic, postEntry, WalletError, openWallet, type AuditContext } from "../src/lib/wallet/service";
import { cancelDemoDeposit, confirmDemoDeposit, createDemoDeposit, ledgerBalance } from "../src/lib/wallet/transactions";
import { DEPOSIT_DAILY_CAP, DEPOSIT_MAX, MAX_BALANCE } from "../src/lib/wallet/limits";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${!ok && detail !== undefined ? `  -> ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}
async function code(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof WalletError ? e.code : `other:${(e as Error).message}`;
  }
}

async function main() {
  const username = `selftest_${Date.now().toString(36)}`;
  const user = await prisma.user.create({ data: { username, displayName: "Self Test" } });
  const ctx: AuditContext = { actorId: user.id, ip: "selftest" };
  try {
    const wallet = await atomic((db) => openWallet(db, user.id, 1_000_00, ctx));
    const balance = async () => (await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).balance;

    console.log("Balance validation");
    check("rejects zero", (await code(atomic((db) => postEntry(db, { walletId: wallet.id, type: "bet", amount: 0, ctx })))) === "invalid");
    check("rejects fractional cents", (await code(atomic((db) => postEntry(db, { walletId: wallet.id, type: "win", amount: 1.5, ctx })))) === "invalid");
    check("rejects overdraft", (await code(atomic((db) => postEntry(db, { walletId: wallet.id, type: "bet", amount: -1_000_01, ctx })))) === "funds");
    check("balance unchanged after rejects", (await balance()) === 1_000_00);

    console.log("Concurrency: 20 parallel 100-credit bets against 1,000 credits");
    const results = await Promise.all(
      Array.from({ length: 20 }, () => code(atomic((db) => postEntry(db, { walletId: wallet.id, type: "bet", amount: -100_00, ctx })))),
    );
    check("exactly 10 succeed", results.filter((r) => r === "ok").length === 10, results);
    check("balance is exactly zero, never negative", (await balance()) === 0);

    console.log("Duplicate protection");
    const key = randomUUID();
    await atomic((db) => postEntry(db, { walletId: wallet.id, type: "bonus", amount: 50_00, ctx, idempotencyKey: key }));
    const dup = await code(atomic((db) => postEntry(db, { walletId: wallet.id, type: "bonus", amount: 50_00, ctx, idempotencyKey: key })));
    check("replayed request id is refused", dup === "duplicate", dup);
    check("duplicate did not move money (rolled back)", (await balance()) === 50_00);

    console.log("Atomicity: failure after the balance change rolls everything back");
    const before = await balance();
    const rows = await prisma.transaction.count({ where: { walletId: wallet.id } });
    await code(
      atomic(async (db) => {
        await postEntry(db, { walletId: wallet.id, type: "bonus", amount: 10_00, ctx });
        throw new Error("boom");
      }),
    );
    check("balance restored", (await balance()) === before);
    check("no ledger row left behind", (await prisma.transaction.count({ where: { walletId: wallet.id } })) === rows);

    console.log("Demo deposits");
    const depKey = randomUUID();
    const [d1, d2] = await Promise.all([
      createDemoDeposit({ walletId: wallet.id, currency: "BTC", cents: 6_500_00, idempotencyKey: depKey, ctx }),
      createDemoDeposit({ walletId: wallet.id, currency: "BTC", cents: 6_500_00, idempotencyKey: depKey, ctx }),
    ]);
    check("double-submitted deposit creates one row", d1.tx.id === d2.tx.id && d1.duplicate !== d2.duplicate, [d1.duplicate, d2.duplicate]);
    check("pending deposit does not change balance", (await balance()) === before);
    check("demo coin amount is exact", d1.tx.cryptoAmount === "0.10000000", d1.tx.cryptoAmount);
    check("demo address is not a real address", /^DEMO-BTC-/.test(d1.tx.demoAddress ?? ""));

    const confirms = await Promise.all(
      Array.from({ length: 8 }, () => confirmDemoDeposit({ walletId: wallet.id, transactionId: d1.tx.id, ctx }).then((r) => (r.alreadyDone ? "again" : "applied"), (e) => (e as WalletError).code)),
    );
    check("8 parallel confirms credit exactly once", (await balance()) === before + 6_500_00, { confirms, bal: await balance() });
    check("cancel after confirm is refused", (await code(cancelDemoDeposit({ walletId: wallet.id, transactionId: d1.tx.id, ctx }))) === "state");

    const d3 = await createDemoDeposit({ walletId: wallet.id, currency: "USDT", cents: 1_000_00, idempotencyKey: randomUUID(), ctx });
    await cancelDemoDeposit({ walletId: wallet.id, transactionId: d3.tx.id, ctx });
    check("confirm after cancel is refused", (await code(confirmDemoDeposit({ walletId: wallet.id, transactionId: d3.tx.id, ctx }))) === "state");

    const other = await prisma.user.findFirstOrThrow({ where: { username: "guest" }, include: { wallet: true } });
    check(
      "cannot confirm another wallet's deposit",
      (await code(confirmDemoDeposit({ walletId: other.wallet!.id, transactionId: d3.tx.id, ctx }))) === "not_found",
    );
    check("rejects over-limit deposit", (await code(createDemoDeposit({ walletId: wallet.id, currency: "ETH", cents: DEPOSIT_MAX + 100, idempotencyKey: randomUUID(), ctx }))) === "invalid");

    // Daily cap: 6,500 already used. Fill to the cap with 25,000s and expect the overflow to be refused.
    let used = 6_500_00;
    const outcomes: string[] = [];
    while (used + DEPOSIT_MAX <= DEPOSIT_DAILY_CAP) {
      const d = await createDemoDeposit({ walletId: wallet.id, currency: "USDT", cents: DEPOSIT_MAX, idempotencyKey: randomUUID(), ctx });
      await confirmDemoDeposit({ walletId: wallet.id, transactionId: d.tx.id, ctx });
      used += DEPOSIT_MAX;
      outcomes.push("ok");
    }
    check("daily demo cap enforced", (await code(createDemoDeposit({ walletId: wallet.id, currency: "USDT", cents: DEPOSIT_MAX, idempotencyKey: randomUUID(), ctx }))) === "state", outcomes);

    console.log("Balance ceiling");
    const cap = await code(atomic((db) => postEntry(db, { walletId: wallet.id, type: "adjustment", amount: MAX_BALANCE, ctx })));
    check("credit above the demo maximum is refused", cap === "cap", cap);

    console.log("Ledger & audit");
    check("ledger sum equals stored balance", (await ledgerBalance(wallet.id)) === (await balance()));
    const completed = await prisma.transaction.count({ where: { walletId: wallet.id, status: "completed" } });
    const moneyAudits = await prisma.auditLog.count({ where: { walletId: wallet.id, balanceAfter: { not: null }, balanceBefore: { not: null } } });
    check("one audit row with before/after per completed entry", completed === moneyAudits, { completed, moneyAudits });
    const chain = await prisma.auditLog.findMany({
      where: { walletId: wallet.id, balanceBefore: { not: null }, balanceAfter: { not: null } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const consistent = chain.every((a) => a.balanceAfter! - a.balanceBefore! === a.amount);
    check("every audit row: after - before = amount", consistent);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll wallet checks passed.");
  process.exit(failures ? 1 : 0);
}

main();
