/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/* --- Public API --- */

export default defineConfig({
  root: "apps/web",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.RESTAURANT_DEV_PORT ?? 5173),
    strictPort: true,
    proxy: { "/api": process.env.API_PROXY ?? "http://localhost:3001" },
  },
  build: { outDir: "dist" },
});
