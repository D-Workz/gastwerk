/**
 * Catalog writes for ingredients, products and tables through saveCatalog.
 * Uses the caller's transaction for validation reads, persistence and audit.
 */
import { z } from "zod";
import {
  ingredientSchema,
  productSchema,
  tableSchema,
  type User,
} from "../../../../packages/contracts/src/index";
import { catalog } from "./repository";
import { DomainError } from "./resolve";
import type { Tx } from "../persistence/db";
import { audit, permit } from "../shared/audit";

/**
 * Save a catalog entry as a manager and return its id.
 *
 * The caller supplies an authenticated user and an open transaction, and owns
 * commit/rollback. The HTTP route provides both through mutation().
 * Payload version 0 inserts; a nonzero version must match an existing entry,
 * otherwise the update raises a 409 conflict (including when the entry is missing).
 *
 * Schema parsing validates data and applies declared defaults. Parse failures
 * propagate as ZodError; permission and business checks use DomainError.
 * Database failures also propagate, including duplicate ids on insertion.
 */
export async function saveCatalog(
  tx: Tx,
  user: User,
  payload: unknown,
  params: unknown,
) {
  permit(user, []);

  const { kind } = z
    .object({ kind: z.enum(["ingredient", "product", "table"]) })
    .parse(params);

  const body = z
    .object({ data: z.unknown(), version: z.number().int().min(0) })
    .parse(payload);

  const data =
    kind === "ingredient"
      ? ingredientSchema.parse(body.data)
      : kind === "product"
        ? productSchema.parse(body.data)
        : tableSchema.parse(body.data);

  // Ingredient constraints
  if (kind === "ingredient") {
    const ingredient = ingredientSchema.parse(data);

    const current = (await catalog(tx)).ingredients.find(
      (i) => i.id === ingredient.id,
    );
    // Changing the base unit would reinterpret stored quantities.
    if (current && current.unit !== ingredient.unit)
      throw new DomainError(
        "unit",
        "Base units are immutable; create a new ingredient",
      );

    if (
      new Set(ingredient.portions.map((p) => p.id)).size !==
      ingredient.portions.length
    )
      throw new DomainError("portion", "Duplicate portion identifiers");

    if (
      ingredient.unit === "piece" &&
      !ingredient.fractional &&
      ingredient.portions.some((p) => !Number.isInteger(Number(p.quantity)))
    )
      throw new DomainError("portion", "Portions require whole pieces");
  }

  // Table archival
  if (kind === "table") {
    const table = tableSchema.parse(data);

    // addLine uses this same transaction lock before checking table activity
    // and opening an order. Keep the check and write in the caller's transaction.
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [table.id]);

    if (
      !table.active &&
      (
        await tx.query(
          "SELECT id FROM orders WHERE table_id=$1 AND closed_at IS NULL",
          [table.id],
        )
      ).rowCount
    )
      throw new DomainError(
        "table",
        "Close the open order before archiving this table",
      );
  }

  // Product references and choice consistency
  if (kind === "product") {
    const p = productSchema.parse(data),
      cat = await catalog(tx);

    // References can also appear in size overrides and optional choice effects.
    const referenced = [
      ...Object.keys(p.recipe),
      ...p.sizes.flatMap((s) => [
        ...Object.keys(s.recipe),
        ...Object.values(s.effects).flatMap((choices) =>
          Object.values(choices).flatMap((effects) =>
            effects.map((e) => e.ingredientId),
          ),
        ),
      ]),
      ...(p.quick ?? []),
      ...p.groups.flatMap((g) =>
        g.choices.flatMap((c) => c.effects.map((e) => e.ingredientId)),
      ),
    ];

    if (
      referenced.some(
        (id) => !cat.ingredients.some((i) => i.id === id && i.active),
      )
    )
      throw new DomainError(
        "ingredient",
        "Product references unavailable ingredient",
      );

    if (new Set(p.sizes.map((s) => s.id)).size !== p.sizes.length)
      throw new DomainError("size", "Duplicate size identifiers");

    for (const size of p.sizes) {
      for (const [groupId, choices] of Object.entries(size.effects)) {
        const group = p.groups.find((g) => g.id === groupId);
        if (
          !group ||
          Object.keys(choices).some(
            (id) => !group.choices.some((c) => c.id === id),
          )
        )
          throw new DomainError("option", "Unknown size option mapping");
      }
    }

    if (new Set(p.groups.map((g) => g.id)).size !== p.groups.length)
      throw new DomainError("option", "Duplicate group identifiers");

    for (const g of p.groups) {
      if (new Set(g.choices.map((c) => c.id)).size !== g.choices.length)
        throw new DomainError("option", "Duplicate choice identifiers");
      if (g.defaultChoice && !g.choices.some((c) => c.id === g.defaultChoice))
        throw new DomainError("option", "Unknown default choice");
    }

    // Without a guided choice screen, required groups need a default.
    if (!p.guided && p.groups.some((g) => g.required && !g.defaultChoice))
      throw new DomainError(
        "guided",
        "Required choices need a guided screen or default",
      );
  }

  // Persist with revision checking, then audit through the same transaction.
  if (body.version === 0)
    await tx.query("INSERT INTO catalog(kind,id,data) VALUES($1,$2,$3)", [
      kind,
      data.id,
      data,
    ]);
  else {
    const r = await tx.query(
      "UPDATE catalog SET data=$3,version=version+1 WHERE kind=$1 AND id=$2 AND version=$4",
      [kind, data.id, data, body.version],
    );
    if (!r.rowCount)
      throw new DomainError(
        "conflict",
        "Catalog changed. Reload before saving.",
        409,
      );
  }

  await audit(tx, user.id, kind + "-saved", {
    data,
    previousVersion: body.version,
  });

  return { id: data.id };
}
