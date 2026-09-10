/**
 * Read and parse the singleton venue policy through configuration.
 */
import { policySchema } from "../../../../packages/config/src/index";
import { DomainError } from "../catalog/resolve";
import type { Tx } from "../persistence/db";

/**
 * Return parsed policy plus the database row revision, distinct from policy.version.
 * Missing row 1 raises a setup DomainError (503); malformed stored policy raises
 * ZodError. Initialization is performed separately by seed or production bootstrap.
 */
export async function configuration(tx: Tx) {
  const r = await tx.query<{ data: unknown; version: number }>(
    "SELECT data,version FROM configuration WHERE id=1",
  );
  const row = r.rows[0];
  if (!row) throw new DomainError("setup", "Run database seed", 503);
  return { policy: policySchema.parse(row.data), version: row.version };
}
