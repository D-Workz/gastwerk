/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import { defineConfig } from "@playwright/test";

/* --- Public API --- */

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  globalSetup: "./tests/e2e/setup.ts",
  use: { baseURL: "http://localhost:5180", trace: "retain-on-failure" },
  webServer: [
    {
      command: "npm run dev:api",
      url: "http://localhost:3002/api/health",
      reuseExistingServer: false,
      env: {
        DATABASE_URL: "postgres://venue:venue_local@localhost:5432/venue_e2e",
        PORT: "3002",
        APP_ORIGIN: "http://localhost:5180",
      },
    },
    {
      command: "npm run dev:web -- --port 5180",
      url: "http://localhost:5180",
      reuseExistingServer: false,
      env: { API_PROXY: "http://localhost:3002" },
    },
  ],
});
