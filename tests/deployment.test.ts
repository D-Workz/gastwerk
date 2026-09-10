/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { runtimeEnvironment } from "../apps/api/src/deployment/environment";

const directory = mkdtempSync(join(tmpdir(), "venue-env-"));
const secret = join(directory, "password");
writeFileSync(secret, "test-only:a@b/#%?password\n");
const production = {
  NODE_ENV: "production",
  COOKIE_SECURE: "true",
  APP_ORIGIN: "https://restaurant.example.com",
  API_TRUSTED_PROXY: "172.30.84.3",
  DATABASE_PASSWORD_FILE: secret,
};

afterAll(() => rmSync(directory, { recursive: true }));

it("preserves development defaults and encodes production database passwords", () => {
  expect(runtimeEnvironment({}).COOKIE_SECURE).toBe("false");
  const url = new URL(runtimeEnvironment(production).DATABASE_URL);
  expect(decodeURIComponent(url.password)).toBe("test-only:a@b/#%?password");
  expect(url.hostname).toBe("db");
});

it("fails closed for missing secrets, insecure origins, cookie flags and ambiguous credentials", () => {
  for (const patch of [
    { DATABASE_PASSWORD_FILE: undefined },
    { COOKIE_SECURE: "false" },
    { APP_ORIGIN: "http://restaurant.example.com" },
    { APP_ORIGIN: "https://restaurant.example.com/path" },
    { DEMO_PASSWORD: "known-development-password" },
    { DATABASE_URL: "postgres://unapproved" },
    { API_TRUSTED_PROXY: "true" },
  ])
    expect(() => runtimeEnvironment({ ...production, ...patch })).toThrow();
  writeFileSync(secret, "venue_local");
  expect(() => runtimeEnvironment(production)).toThrow("non-default secret");
});
