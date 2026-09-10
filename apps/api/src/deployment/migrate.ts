/**
 * One-shot migration entry point for the API build. Runs at module load and closes
 * the pool on success or failure; it is not a helper to import into the server.
 */
import { migrate } from "../persistence/migrate";
import { pool } from "../persistence/db";

try {
  await migrate();
  console.log("Migrations completed.");
} catch {
  console.error("Migration failed; inspect database state before retrying.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
