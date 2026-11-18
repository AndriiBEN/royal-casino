/**
 * Runs once before the test run. Tests get their own SQLite file (prisma/test.db), created
 * fresh from the schema, so they never read or write the development database.
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

export const TEST_DATABASE_URL = "file:./test.db";

export default function setup() {
  for (const f of ["test.db", "test.db-journal"]) rmSync(join(process.cwd(), "prisma", f), { force: true });
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}
