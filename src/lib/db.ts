import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * SQLite allows one writer at a time. With a pool of connections, parallel interactive
 * transactions (e.g. several wallet updates at once) contend for the write lock and can
 * fail with socket timeouts. One connection makes Prisma queue them instead, which is
 * correct and fast for a single local process. Explicit values in DATABASE_URL win.
 */
function datasourceUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw?.startsWith("file:")) return raw;
  const [base, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  if (!params.has("connection_limit")) params.set("connection_limit", "1");
  if (!params.has("socket_timeout")) params.set("socket_timeout", "20");
  return `${base}?${params.toString()}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
