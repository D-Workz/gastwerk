/**
 * Line projection and order-total SQL through a supplied client.
 * Authorization and response filtering belong to callers.
 */
import type { Line, Order } from "../../../../packages/contracts/src/index";
import type { Tx } from "../persistence/db";

/**
 * Shared projection with aliases matching Line. Callers append predicates/locks;
 * the TypeScript query type does not runtime-validate stored JSON.
 */
export const lineSelect = `SELECT l.id,l.order_id AS "orderId",o.table_id AS "tableId",l.version,l.state,l.input,l.snapshot,l.created_by AS "createdBy",l.changed_by AS "changedBy",l.created_at AS "createdAt",l.updated_at AS "updatedAt",l.reason,l.replacement_of AS "replacementOf" FROM lines l JOIN orders o ON o.id=l.order_id`;

/**
 * Load every line in creation order, including cancelled and closed-order history.
 * Role/station filtering is performed by readState, not this query.
 */
export async function lines(tx: Tx) {
  return (await tx.query<Line>(lineSelect + " ORDER BY l.created_at")).rows;
}

/**
 * Load open and closed orders with totals computed from snapshotted unit price
 * times item count. Cancelled lines contribute zero; totals are decimal strings.
 */
export async function orders(tx: Tx) {
  return (
    await tx.query<Order>(
      `SELECT o.id,o.table_id AS "tableId",o.closed_at AS "closedAt",COALESCE(sum(CASE WHEN l.state <> 'cancelled' THEN (l.snapshot->>'unitPrice')::numeric*(l.input->>'quantity')::integer ELSE 0 END),0)::numeric(24,2)::text AS total FROM orders o LEFT JOIN lines l ON l.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC`,
    )
  ).rows;
}
