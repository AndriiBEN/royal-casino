import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server modules import "server-only" as a bundler guard; it has no runtime role in tests.
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/support/global-setup.ts"],
    setupFiles: ["tests/support/env.ts"],
    testTimeout: 60_000,
    // Integration tests share one SQLite file; run files one after another.
    fileParallelism: false,
  },
});
