/**
 * Read-only recipe/price preview using current catalog data or an existing snapshot.
 * The HTTP route authenticates, checks the role and supplies a transaction.
 */
import type {
  Customization,
  Line,
} from "../../../../packages/contracts/src/index";
import { catalog } from "../catalog/repository";
import { DomainError, resolve } from "../catalog/resolve";
import { configuration } from "../configuration/repository";
import type { Tx } from "../persistence/db";
import { lineSelect } from "./repository";

/**
 * Return a per-serving snapshot without writing or reserving anything. With lineId,
 * use historical definitions/pricing and current ingredients absent from the
 * snapshot; without it, use current catalog/policy. It does not lock the line or
 * check its revision/state, so a successful preview does not authorize a later edit.
 */
export async function preview(tx: Tx, input: Customization, lineId?: string) {
  const cat = await catalog(tx);
  const config = await configuration(tx);
  if (lineId) {
    const line = (await tx.query<Line>(lineSelect + " WHERE l.id=$1", [lineId]))
      .rows[0];
    if (!line) throw new DomainError("missing", "Line not found", 404);
    if (input.productId !== line.input.productId)
      throw new DomainError("product", "Product does not match");
    const ingredients = [
      ...line.snapshot.ingredients,
      ...cat.ingredients.filter(
        (i) => !line.snapshot.ingredients.some((old) => old.id === i.id),
      ),
    ];
    return resolve(
      { ...line.snapshot.product, active: true, available: true },
      ingredients,
      input,
      { ...config.policy, ...line.snapshot.pricingPolicy },
      line.snapshot.policyVersion,
    );
  }

  const product = cat.products.find((p) => p.id === input.productId);
  if (!product) throw new DomainError("product", "Product not found");
  return resolve(
    product,
    cat.ingredients,
    input,
    config.policy,
    config.version,
  );
}
