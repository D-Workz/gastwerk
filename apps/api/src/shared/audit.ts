/**
 * Shared role permission checks and history insertion for API services.
 */
import { randomUUID } from "node:crypto";
import type { User } from "../../../../packages/contracts/src/index";
import { DomainError } from "../catalog/resolve";
import type { Tx } from "../persistence/db";

/**
 * Managers bypass the role list; an empty list therefore permits only managers.
 * Requires a caller-supplied user, not credentials; denial is DomainError (403).
 */
export function permit(user: User, roles: string[]) {
  if (user.role !== "manager" && !roles.includes(user.role))
    throw new DomainError("forbidden", "Permission denied", 403);
}

/**
 * Append history using the supplied client. Caller owns the transaction and must
 * choose safe detail fields; this helper JSON-serializes detail without redaction.
 */
export async function audit(
  tx: Tx,
  actor: string,
  action: string,
  detail: unknown,
  lineId: string | null = null,
) {
  await tx.query(
    "INSERT INTO history(id,line_id,actor,action,detail) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), lineId, actor, action, JSON.stringify(detail)],
  );
}
