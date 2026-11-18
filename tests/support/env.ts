// Load the rest of .env (Next.js does this for the app), then point Prisma at the
// throwaway test database created by global-setup.ts. Tests never touch prisma/casino.db.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file */
}
process.env.DATABASE_URL = "file:./test.db";
