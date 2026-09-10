/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import { defineConfig } from "vitest/config";

/* --- Public API --- */

export default defineConfig({
  test: {
    include: ["tests/**/*.integration.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://venue:venue_local@localhost:5432/venue_test",
    },
  },
});
