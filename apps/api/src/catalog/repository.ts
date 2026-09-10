/**
 * Catalog read projection for validation and ordering. Reads through a supplied client
 * and parses stored documents with shared schemas; does not own the transaction.
 */
import {
  ingredientSchema,
  productSchema,
  tableSchema,
} from "../../../../packages/contracts/src/index";
import type { Tx } from "../persistence/db";

/**
 * Return all ingredient/product/table documents with their stored row revisions.
 * Zod parsing can fail on stored data as well as database reads; archived entries
 * remain in the result for callers to interpret.
 */
export async function catalog(tx: Tx) {
  const result = await tx.query<{
    kind: string;
    data: unknown;
    version: number;
  }>("SELECT kind,data,version FROM catalog ORDER BY id");
  return {
    ingredients: result.rows
      .filter((r) => r.kind === "ingredient")
      .map((r) => ({ ...ingredientSchema.parse(r.data), version: r.version })),
    products: result.rows
      .filter((r) => r.kind === "product")
      .map((r) => ({ ...productSchema.parse(r.data), version: r.version })),
    tables: result.rows
      .filter((r) => r.kind === "table")
      .map((r) => ({ ...tableSchema.parse(r.data), version: r.version })),
  };
}
