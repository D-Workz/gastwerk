/**
 * Line transitions and replacements through transition/replace.
 * The caller owns the transaction spanning line state, consumption and audit writes.
 */
import type {
  Customization,
  State,
  User,
} from "../../../../packages/contracts/src/index";
import { DomainError } from "../catalog/resolve";
import { configuration } from "../configuration/repository";
import { consume } from "../inventory/service";
import type { Tx } from "../persistence/db";
import { addLine, lockedLine } from "../service/service";
import { audit, permit } from "../shared/audit";

/**
 * Lock/revision-check a line and enforce role/state rules before writing. Starting
 * preparation calls consume with the same transaction before the state update.
 * Cancellation leaves recorded consumption intact; served cancellation requires
 * a manager and the configured minimum reason length. Returns the affected id.
 */
export async function transition(
  tx: Tx,
  user: User,
  id: string,
  version: number,
  target: State,
  reason = "",
) {
  const line = await lockedLine(tx, id, version);
  if (target === "preparing" || target === "ready")
    permit(user, [line.snapshot.product.station]);
  else permit(user, ["waiter"]);
  const next: Partial<Record<State, State>> = {
    draft: "submitted",
    submitted: "preparing",
    preparing: "ready",
    ready: "served",
  };
  if (target === "cancelled") {
    if (line.state === "cancelled")
      throw new DomainError("state", "Already cancelled", 409);
    if (line.state === "served") {
      permit(user, []);
      const c = await configuration(tx);
      if (reason.trim().length < c.policy.servedCorrectionReasonMin)
        throw new DomainError(
          "reason",
          "A detailed correction reason is required",
        );
    } else if (!reason.trim())
      throw new DomainError("reason", "Cancellation reason required");
  } else if (next[line.state] !== target)
    throw new DomainError("state", "Unsupported transition", 409);
  if (target === "preparing")
    await consume(tx, id, line.snapshot, line.input.quantity, user.id);
  await tx.query(
    "UPDATE lines SET state=$2,version=version+1,changed_by=$3,updated_at=now(),reason=$4 WHERE id=$1",
    [id, target, user.id, reason || null],
  );
  await audit(
    tx,
    user.id,
    target,
    { previous: line.state, revision: version, input: line.input, reason },
    id,
  );
  return { id };
}

/**
 * For a preparing/ready line, cancel the original and add a submitted replacement
 * using current catalog/policy. Both operations share the caller's transaction;
 * failures must roll it back. Original consumption is not reversed.
 */
export async function replace(
  tx: Tx,
  user: User,
  id: string,
  version: number,
  input: Customization,
  reason: string,
) {
  permit(user, ["waiter"]);
  const line = await lockedLine(tx, id, version);
  if (!["preparing", "ready"].includes(line.state))
    throw new DomainError(
      "state",
      "Replacement requires preparing or ready item",
    );
  await transition(tx, user, id, version, "cancelled", reason);
  return addLine(tx, user, line.tableId, input, id);
}
