/**
 * Explicit initial-manager setup through bootstrapAdmin; separate from demo seeding.
 * Importing the database module also initializes environment settings and the pool.
 */
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { defaultPolicy } from "../../../../packages/config/src/index";
import { pool, transaction } from "../persistence/db";
import { readSecret } from "./environment";

/**
 * Validate credentials, then create the initial manager only when no users exist.
 * Uses the same initialization lock as seed; inserts missing policy without
 * replacing an existing row. This lock coordinates those initialization tools,
 * not every possible writer. Migration must have created the tables beforehand.
 */
export async function bootstrapAdmin(username: string, password: string) {
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(username))
    throw new Error("Invalid initial administrator username");
  if (
    password.length < 16 ||
    password.length > 200 ||
    /[\r\n]/.test(password) ||
    password === "local-demo-change-me"
  )
    throw new Error(
      "Initial administrator password must be non-default, single-line and 16–200 characters",
    );
  const hash = await argon2.hash(password);
  await transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(812732)");
    const users = await tx.query("SELECT 1 FROM users LIMIT 1");
    if (users.rowCount)
      throw new Error(
        "Administrator setup refused: users already exist; use normal user administration",
      );
    await tx.query(
      "INSERT INTO configuration(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING",
      [defaultPolicy],
    );
    await tx.query(
      "INSERT INTO users(id,username,password,role,preferences) VALUES($1,$2,$3,'manager',$4)",
      [randomUUID(), username, hash, defaultPolicy.display],
    );
  });
}

if (/bootstrap\.(ts|js)$/.test(process.argv[1] ?? "")) {
  try {
    await bootstrapAdmin(
      process.env.ADMIN_USERNAME ?? "",
      readSecret(process.env.ADMIN_PASSWORD_FILE, "administrator password"),
    );
    console.log(
      "Initial administrator created; no demo catalog or accounts were seeded.",
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Administrator setup failed",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
