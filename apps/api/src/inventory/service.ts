/**
 * Ingredient ledger writes and balance reads. Fulfillment chooses when to consume;
 * these helpers use the supplied transaction and do not begin or commit one.
 */
import Decimal from "decimal.js";
import { randomUUID } from "node:crypto";
import type { Snapshot } from "../../../../packages/contracts/src/index";
import type { Tx } from "../persistence/db";

/**
 * Append negative per-serving quantities multiplied by item count. Caller must
 * provide validated input and hold the line lock within the state-change transaction.
 * Fulfillment supplies that convention; this helper does not check roles/state or
 * stock sufficiency. The database consumption index rejects duplicate line/ingredient
 * writes rather than turning them into successful no-ops.
 */
export async function consume(
  tx: Tx,
  lineId: string,
  snapshot: Snapshot,
  quantity: number,
  actor: string,
) {
  for (const [id, q] of Object.entries(snapshot.resolved)) {
    await tx.query(
      "INSERT INTO movements(id,ingredient_id,quantity,kind,reason,actor,line_id) VALUES($1,$2,$3,'consumption','Preparation started',$4,$5)",
      [
        randomUUID(),
        id,
        new Decimal(q).mul(quantity).negated().toString(),
        actor,
        lineId,
      ],
    );
  }
}

/**
 * Return decimal-string sums keyed by ingredient id. Ingredients with no movements
 * are absent; negative balances are possible. No catalog availability is changed.
 */
export async function balances(tx: Tx) {
  const r = await tx.query<{ ingredientId: string; quantity: string }>(
    'SELECT ingredient_id AS "ingredientId",sum(quantity)::text AS quantity FROM movements GROUP BY ingredient_id',
  );
  return Object.fromEntries(r.rows.map((r) => [r.ingredientId, r.quantity]));
}
