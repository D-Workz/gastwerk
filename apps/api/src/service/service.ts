/**
 * Order and line operations: locking, creation, edits/splits and closure.
 * Callers own the transaction so related writes, locks and audit events stay together.
 */
import { withChoiceDefaults } from "../../../../packages/contracts/src/index";
import { randomUUID } from "node:crypto";
import type {
  Customization,
  Line,
  User,
} from "../../../../packages/contracts/src/index";
import { catalog } from "../catalog/repository";
import { DomainError, resolve } from "../catalog/resolve";
import { configuration } from "../configuration/repository";
import type { Tx } from "../persistence/db";
import { audit, permit } from "../shared/audit";
import { lineSelect } from "./repository";

/**
 * Acquire the table advisory lock before the line row lock, then check revision.
 * Returns the row or DomainError for missing/stale input. Caller owns the transaction;
 * this helper neither checks permissions nor ensures the order is still open.
 */
export async function lockedLine(tx: Tx, id: string, version: number) {
  const table = (
    await tx.query<{ table_id: string }>(
      "SELECT o.table_id FROM lines l JOIN orders o ON o.id=l.order_id WHERE l.id=$1",
      [id],
    )
  ).rows[0];
  if (table)
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      table.table_id,
    ]);
  const row = (
    await tx.query<Line>(lineSelect + " WHERE l.id=$1 FOR UPDATE OF l", [id])
  ).rows[0];
  if (!row) throw new DomainError("missing", "Line not found", 404);
  if (row.version !== version)
    throw new DomainError(
      "conflict",
      "This item changed. Refresh and review the latest revision.",
      409,
    );
  return row;
}

/**
 * Require waiter/manager permission and schema-parsed customization. Lock the table
 * before checking activity, then use current catalog/policy to create an order if
 * needed and insert a line. replacementOf selects submitted rather than draft state.
 * Returns the new line id; caller must commit/rollback the transaction.
 */
export async function addLine(
  tx: Tx,
  user: User,
  tableId: string,
  input: Customization,
  replacementOf: string | null = null,
) {
  permit(user, ["waiter"]);
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [tableId]);
  const cat = await catalog(tx);
  if (!cat.tables.some((t) => t.id === tableId && t.active))
    throw new DomainError("table", "Table unavailable");

  const product = cat.products.find((p) => p.id === input.productId);
  if (!product) throw new DomainError("product", "Product not found");
  input = withChoiceDefaults(input, product);
  const config = await configuration(tx);
  const snapshot = resolve(
    product,
    cat.ingredients,
    input,
    config.policy,
    config.version,
  );
  let order = (
    await tx.query<{ id: string }>(
      "SELECT id FROM orders WHERE table_id=$1 AND closed_at IS NULL",
      [tableId],
    )
  ).rows[0];
  if (!order) {
    order = { id: randomUUID() };
    await tx.query("INSERT INTO orders(id,table_id) VALUES($1,$2)", [
      order.id,
      tableId,
    ]);
  }
  const id = randomUUID();
  await tx.query(
    "INSERT INTO lines(id,order_id,state,input,snapshot,created_by,changed_by,replacement_of) VALUES($1,$2,$3,$4,$5,$6,$6,$7)",
    [
      id,
      order.id,
      replacementOf ? "submitted" : "draft",
      input,
      snapshot,
      user.id,
      replacementOf,
    ],
  );
  await audit(
    tx,
    user.id,
    replacementOf ? "replacement-submitted" : "draft-created",
    { input, snapshot },
    id,
  );
  return { id };
}

/**
 * Revision-check and edit a draft/submitted line of the same product. Historical
 * definitions/pricing remain the basis for recalculation. A split requires one item
 * from a multi-item line and returns a new line id; otherwise returns the original.
 * The caller owns rollback across the line updates and audit writes.
 */
export async function editLine(
  tx: Tx,
  user: User,
  id: string,
  version: number,
  input: Customization,
  split: boolean,
) {
  permit(user, ["waiter"]);
  const line = await lockedLine(tx, id, version);
  if (!["draft", "submitted"].includes(line.state))
    throw new DomainError(
      "state",
      "Use replacement after preparation starts",
      409,
    );
  if (input.productId !== line.input.productId)
    throw new DomainError(
      "product",
      "Cannot change product on an existing line",
    );
  input = withChoiceDefaults(input, line.snapshot.product);
  const cat = await catalog(tx);
  const config = await configuration(tx);
  // Recalculate from historical definitions/pricing; add current definitions only
  // for ingredient ids not captured in the original snapshot.
  const ingredients = [
    ...line.snapshot.ingredients,
    ...cat.ingredients.filter(
      (i) => !line.snapshot.ingredients.some((old) => old.id === i.id),
    ),
  ];
  const snapshot = resolve(
    { ...line.snapshot.product, active: true, available: true },
    ingredients,
    input,
    { ...config.policy, ...line.snapshot.pricingPolicy },
    line.snapshot.policyVersion,
  );
  if (split) {
    if (line.input.quantity < 2 || input.quantity !== 1)
      throw new DomainError(
        "split",
        "Split requires one item from a multiple-item line",
      );
    await tx.query(
      "UPDATE lines SET input=$2,version=version+1,changed_by=$3,updated_at=now() WHERE id=$1",
      [id, { ...line.input, quantity: line.input.quantity - 1 }, user.id],
    );
    const newId = randomUUID();
    await tx.query(
      "INSERT INTO lines(id,order_id,state,input,snapshot,created_by,changed_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        newId,
        line.orderId,
        line.state,
        input,
        snapshot,
        line.createdBy,
        user.id,
      ],
    );
    await audit(tx, user.id, "split", { source: id, input }, newId);
    await audit(tx, user.id, "split-source", { newId }, id);
    return { id: newId };
  }
  await tx.query(
    "UPDATE lines SET input=$2,snapshot=$3,version=version+1,changed_by=$4,updated_at=now() WHERE id=$1",
    [id, input, snapshot, user.id],
  );
  await audit(
    tx,
    user.id,
    line.state === "submitted" ? "amended" : "draft-edited",
    { previous: line.input, input, snapshot },
    id,
  );
  return { id };
}

/**
 * Require waiter/manager permission and reject an order found missing, already
 * closed or unfinished. Uses the table lock, but closed_at is read before acquiring it
 * and is not reread afterward. Returns the order id; caller owns the transaction.
 */
export async function closeOrder(tx: Tx, user: User, id: string) {
  permit(user, ["waiter"]);
  const order = (
    await tx.query<{ table_id: string; closed_at: Date | null }>(
      "SELECT table_id,closed_at FROM orders WHERE id=$1",
      [id],
    )
  ).rows[0];
  if (!order) throw new DomainError("missing", "Order not found", 404);
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    order.table_id,
  ]);
  if (order.closed_at)
    throw new DomainError("closed", "Order already closed", 409);
  const unfinished = await tx.query(
    "SELECT id FROM lines WHERE order_id=$1 AND state NOT IN ('served','cancelled')",
    [id],
  );
  if (unfinished.rowCount)
    throw new DomainError(
      "unfinished",
      "Serve or cancel every item before closing",
      409,
    );
  await tx.query("UPDATE orders SET closed_at=now() WHERE id=$1", [id]);
  await audit(tx, user.id, "order-closed", { orderId: id });
  return { id };
}
