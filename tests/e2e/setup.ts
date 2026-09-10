/**
 * Playwright database setup for the isolated venue_e2e environment. Execution
 * drops and recreates its public schema, then runs application migration and
 * seed entry points before browser workflows start.
 */
import pg from "pg";

export default async function setup() {
  const pool = new pg.Pool({
    connectionString: "postgres://venue:venue_local@localhost:5432/venue_e2e",
  });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await pool.end();
  process.env.DATABASE_URL =
    "postgres://venue:venue_local@localhost:5432/venue_e2e";
  const { migrate } = await import("../../apps/api/src/persistence/migrate");
  const { seed } = await import("../../apps/api/src/persistence/seed");
  const { pool: appPool } = await import("../../apps/api/src/persistence/db");
  await migrate();
  await seed();
  await appPool.end();
}
