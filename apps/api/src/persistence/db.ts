/**
 * Environment and PostgreSQL pool initialization at import time.
 * transaction owns connection checkout, BEGIN/COMMIT/ROLLBACK and release.
 */
import pg from "pg";
import { runtimeEnvironment } from "../deployment/environment";

export const env = runtimeEnvironment(process.env);

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
export type Tx = pg.PoolClient;

/**
 * Run work on one checked-out client. Commit on success; attempt rollback on
 * failure and always release the client. Callers must await related work and use
 * this client for writes that should commit together. Rollback failure can replace
 * the original error; this wrapper does not retry or nest transactions.
 */
export async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    const result = await work(tx);
    await tx.query("COMMIT");
    return result;
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
