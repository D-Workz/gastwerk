/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/* --- Public API --- */

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/**/*.integration.test.ts"],
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
  },
});
