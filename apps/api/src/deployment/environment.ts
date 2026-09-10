/**
 * Runtime environment parsing and production secret-file reads.
 * runtimeEnvironment adds production checks before applying the shared envSchema.
 */
import { isIP } from "node:net";
import { readFileSync } from "node:fs";
import { envSchema } from "../../../../packages/config/src/index";

type Variables = Record<string, string | undefined>;

/**
 * Read a UTF-8 secret file, remove one trailing newline and reject short,
 * multiline or known demo values. Errors identify the supplied name, not the
 * secret contents or filesystem error details. No whitespace trimming is applied.
 */
export function readSecret(path: string | undefined, name: string): string {
  if (!path) throw new Error(`Missing ${name} file setting`);
  let value: string;
  try {
    value = readFileSync(path, "utf8").replace(/\r?\n$/, "");
  } catch {
    throw new Error(`Cannot read ${name} file`);
  }
  if (
    value.length < 16 ||
    /[\r\n]/.test(value) ||
    ["local-demo-change-me", "venue_local"].includes(value)
  )
    throw new Error(
      `${name} must be a non-default secret of at least 16 characters on one line`,
    );
  return value;
}

/**
 * Parse supplied settings. Outside production, use shared development defaults.
 * Production requires HTTPS/cookie/proxy settings and reads the database password
 * file to construct the URL; explicit DATABASE_URL and DEMO_PASSWORD are rejected.
 * Configuration and file errors propagate; this function does not connect to DB.
 */
export function runtimeEnvironment(variables: Variables) {
  if (variables.NODE_ENV !== "production") return envSchema.parse(variables);
  if (variables.DATABASE_URL || variables.DEMO_PASSWORD)
    throw new Error(
      "Production uses a database secret file and never DEMO_PASSWORD or DATABASE_URL",
    );
  if (variables.COOKIE_SECURE !== "true")
    throw new Error("Production requires COOKIE_SECURE=true");
  let origin: URL;
  try {
    origin = new URL(variables.APP_ORIGIN ?? "");
  } catch {
    throw new Error("Production requires an HTTPS APP_ORIGIN");
  }
  if (
    origin.protocol !== "https:" ||
    origin.origin !== variables.APP_ORIGIN ||
    origin.username ||
    origin.password
  )
    throw new Error(
      "Production APP_ORIGIN must be an HTTPS origin without a path or credentials",
    );
  if (!isIP(variables.API_TRUSTED_PROXY ?? ""))
    throw new Error("Production requires one explicit API_TRUSTED_PROXY IP");
  const password = readSecret(
    variables.DATABASE_PASSWORD_FILE,
    "database password",
  );
  const host = variables.DATABASE_HOST ?? "db";
  const user = variables.DATABASE_USER ?? "venue";
  const name = variables.DATABASE_NAME ?? "venue";
  if (!/^[a-zA-Z0-9.-]+$/.test(host) || !/^[a-zA-Z0-9_]+$/.test(name))
    throw new Error("Invalid production database host/name");
  return envSchema.parse({
    ...variables,
    DATABASE_URL: `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${name}`,
  });
}
