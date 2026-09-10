/**
 * Repeat, decrement and undo for order lines in a caller-owned transaction.
 * Intentional repeats are separate actions; mutation() handles same-key retries.
 */
import { isDeepStrictEqual } from "node:util";
import {
  type Customization,
  type Line,
  type User,
  withChoiceDefaults,
} from "../../../../packages/contracts/src/index";
import { catalog } from "../catalog/repository";
import { DomainError, resolve } from "../catalog/resolve";
import { configuration } from "../configuration/repository";
import type { Tx } from "../persistence/db";
import { audit, permit } from "../shared/audit";
import { lineSelect } from "./repository";
import { addLine, lockedLine } from "./service";

/**
 * Compare repeat identity without item count or edit-array ordering. Notes, size
 * and choices remain part of the identity; the supplied customization is not mutated.
 */
function configurationOf(input: Customization) {
  return {
    ...input,
    quantity: 1,
    edits: [...input.edits].sort((a, b) =>
      a.ingredientId.localeCompare(b.ingredientId),
    ),
  };
}

/**
 * Require waiter/manager permission, an open source order and matching expected
 * customization (quantity excluded). Re-resolve against current catalog/policy;
 * changed price, resolved quantities or station require review (409). Increment a
 * matching draft below 100 items, or add a new draft; return its id.
 */
export async function repeatLine(
  tx: Tx,
  user: User,
  id: string,
  expected: Customization,
) {
  permit(user, ["waiter"]);
  const source = (await tx.query<Line>(lineSelect + " WHERE l.id=$1", [id]))
    .rows[0];
  if (!source) throw new DomainError("missing", "Line not found", 404);
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    source.tableId,
  ]);
  const line = (
    await tx.query<Line>(lineSelect + " WHERE l.id=$1 FOR UPDATE OF l", [id])
  ).rows[0];
  if (!line) throw new DomainError("missing", "Line not found", 404);
  const open = await tx.query(
    "SELECT id FROM orders WHERE id=$1 AND closed_at IS NULL",
    [line.orderId],
  );
  if (!open.rowCount || line.state === "cancelled")
    throw new DomainError("closed", "Cannot repeat this item", 409);
  if (
    !isDeepStrictEqual(configurationOf(line.input), configurationOf(expected))
  )
    throw new DomainError(
      "conflict",
      "Item configuration changed; review it",
      409,
    );
  const cat = await catalog(tx);

  const product = cat.products.find((p) => p.id === line.input.productId);
  if (!product) throw new DomainError("unavailable", "Product unavailable");
  const input = withChoiceDefaults({ ...line.input, quantity: 1 }, product);
  const config = await configuration(tx);
  const snapshot = resolve(
    product,
    cat.ingredients,
    input,
    config.policy,
    config.version,
  );
  if (
    snapshot.unitPrice !== line.snapshot.unitPrice ||
    !isDeepStrictEqual(snapshot.resolved, line.snapshot.resolved) ||
    product.station !== line.snapshot.product.station
  )
    throw new DomainError(
      "repeat_review",
      "Recipe or price changed; review the current product",
      409,
    );
  // Sent lines are never incremented; matching looks only at drafts in this order.
  const drafts = (
    await tx.query<Line>(
      lineSelect +
        " WHERE l.order_id=$1 AND l.state='draft' ORDER BY l.id FOR UPDATE OF l",
      [line.orderId],
    )
  ).rows;
  const match = drafts.find(
    (l) =>
      l.input.quantity < 100 &&
      isDeepStrictEqual(configurationOf(l.input), configurationOf(input)) &&
      l.snapshot.unitPrice === snapshot.unitPrice &&
      isDeepStrictEqual(l.snapshot.resolved, snapshot.resolved),
  );
  if (!match) return addLine(tx, user, line.tableId, input);
  await tx.query(
    "UPDATE lines SET input=$2,version=version+1,changed_by=$3,updated_at=now() WHERE id=$1",
    [match.id, { ...match.input, quantity: match.input.quantity + 1 }, user.id],
  );
  await audit(tx, user.id, "draft-repeated", { source: id }, match.id);
  return { id: match.id };
}

/**
 * Revision-check a draft and subtract one. Removing its last item cancels the line
 * but stores quantity 1 for undo; the audit detail records the computed zero.
 * No inventory consumption is written.
 */
export async function decrementLine(
  tx: Tx,
  user: User,
  id: string,
  version: number,
) {
  permit(user, ["waiter"]);
  const line = await lockedLine(tx, id, version);
  if (line.state !== "draft")
    throw new DomainError(
      "state",
      "Only unsent quantities can be reduced",
      409,
    );
  const quantity = line.input.quantity - 1;
  await tx.query(
    "UPDATE lines SET input=$2,state=$3,version=version+1,changed_by=$4,updated_at=now() WHERE id=$1",
    [
      id,
      { ...line.input, quantity: Math.max(1, quantity) },
      quantity ? "draft" : "cancelled",
      user.id,
    ],
  );
  await audit(tx, user.id, "draft-reduced", { quantity }, id);
  return { id };
}

/**
 * Revision-check a cancelled line whose latest history action is draft-reduced,
 * and require its order to remain open. Restore draft state with a new revision.
 * Caller owns the transaction; no ingredients are consumed.
 */
export async function undoRemoval(
  tx: Tx,
  user: User,
  id: string,
  version: number,
) {
  permit(user, ["waiter"]);
  const line = await lockedLine(tx, id, version);
  const last = (
    await tx.query<{ action: string }>(
      "SELECT action FROM history WHERE line_id=$1 ORDER BY at DESC LIMIT 1",
      [id],
    )
  ).rows[0];
  const open = await tx.query(
    "SELECT id FROM orders WHERE id=$1 AND closed_at IS NULL",
    [line.orderId],
  );
  if (
    line.state !== "cancelled" ||
    last?.action !== "draft-reduced" ||
    !open.rowCount
  )
    throw new DomainError("state", "Removal can no longer be undone", 409);
  await tx.query(
    "UPDATE lines SET state='draft',version=version+1,changed_by=$2,updated_at=now() WHERE id=$1",
    [id, user.id],
  );
  await audit(tx, user.id, "draft-restored", {}, id);
  return { id };
}
