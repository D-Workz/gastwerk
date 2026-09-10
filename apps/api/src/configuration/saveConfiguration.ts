/**
 * Manager policy updates through saveConfiguration, using the mutation caller's
 * transaction for the revision-checked write and audit event.
 */
import { z } from "zod";
import { policySchema } from "../../../../packages/config/src/index";
import { type User } from "../../../../packages/contracts/src/index";
import { DomainError } from "../catalog/resolve";
import type { Tx } from "../persistence/db";
import { audit, permit } from "../shared/audit";

/**
 * Require manager permission and parse { data, version }. Update existing row 1
 * only when its revision matches; a missing/stale row raises DomainError (409).
 * There is no version-0 insertion path here. Schema and database errors propagate.
 */
export async function saveConfiguration(tx: Tx, user: User, payload: unknown) {
  permit(user, []);
  const body = z
    .object({ data: policySchema, version: z.number().int() })
    .parse(payload);
  const r = await tx.query(
    "UPDATE configuration SET data=$1,version=version+1 WHERE id=1 AND version=$2",
    [body.data, body.version],
  );
  if (!r.rowCount)
    throw new DomainError(
      "conflict",
      "Configuration changed. Reload before saving.",
      409,
    );
  await audit(tx, user.id, "configuration-saved", body);
  return { ok: true };
}
