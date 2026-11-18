/**
 * Replaces only the Promotion table with prisma/promotions.ts: `npm run db:promotions`.
 * Players, wallets, games and history are left untouched.
 */
import { PrismaClient } from "@prisma/client";
import { promotions } from "./promotions";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([prisma.promotion.deleteMany(), ...promotions.map((p) => prisma.promotion.create({ data: p }))]);
  console.log(`✔ ${promotions.length} promotions loaded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
