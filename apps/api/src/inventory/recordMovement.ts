/**
 * Manager-entered opening balances, deliveries and corrections.
 * recordMovement validates and converts input, then appends to the caller's transaction.
 */
import Decimal from "decimal.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type User } from "../../../../packages/contracts/src/index";
import { catalog } from "../catalog/repository";
import { DomainError, convert } from "../catalog/resolve";
import type { Tx } from "../persistence/db";
import { permit } from "../shared/audit";

/**
 * Require manager permission and an existing ingredient, then append one movement.
 * Only corrections accept negative quantities. Packs need explicit contents in the
 * ingredient's base unit; whole-piece and precision checks follow conversion.
 * The reason is trimmed by its schema. Archived ingredients are not rejected here.
 */
export async function recordMovement(tx: Tx, user: User, payload: unknown) {
  permit(user, []);
  const b = z
    .object({
      ingredientId: z.string(),
      quantity: z
        .string()
        .regex(/^-?\d{1,9}(\.\d{1,3})?$/)
        .refine((v) => Number(v) !== 0),
      unit: z.enum(["g", "ml", "piece", "kg", "l", "pack"]),
      packQuantity: z
        .string()
        .regex(/^\d+(\.\d{1,3})?$/)
        .optional(),
      kind: z.enum(["opening", "delivery", "correction"]),
      reason: z.string().trim().min(1).max(1000),
    })
    .parse(payload);
  const cat = await catalog(tx);

  const i = cat.ingredients.find((i) => i.id === b.ingredientId);
  if (!i) throw new DomainError("ingredient", "Ingredient not found");
  const negative = b.quantity.startsWith("-");
  if (negative && b.kind !== "correction")
    throw new DomainError("quantity", "Only corrections may be negative");
  const q = convert(
    negative ? b.quantity.slice(1) : b.quantity,
    b.unit,
    i.unit,
    b.packQuantity,
  );
  if (i.unit === "piece" && !i.fractional && !new Decimal(q).isInteger())
    throw new DomainError("quantity", "Whole pieces required");
  if (
    new Decimal(q).decimalPlaces() > 3 ||
    new Decimal(q).gt("999999999999999999999")
  )
    throw new DomainError(
      "quantity",
      "Converted quantity exceeds supported precision",
    );
  await tx.query(
    "INSERT INTO movements(id,ingredient_id,quantity,kind,reason,actor) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), i.id, negative ? "-" + q : q, b.kind, b.reason, user.id],
  );
  return { ok: true };
}
