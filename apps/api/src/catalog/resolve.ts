/**
 * Per-serving recipe and price calculation through resolve, plus unit conversion.
 * No database access: callers supply current or historical definitions and pricing.
 */
import Decimal from "decimal.js";
import type { Policy } from "../../../../packages/config/src/index";
import type {
  Customization,
  Ingredient,
  Product,
  Snapshot,
} from "../../../../packages/contracts/src/index";

/**
 * Business error carrying the API response code and HTTP status (400 by default).
 * Schema and Decimal parsing failures are separate error sources.
 */
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/**
 * Convert a positive decimal quantity in matching units, kg to g, l to ml, or
 * an explicit pack multiplier expressed in the destination unit. Unsupported
 * conversions/nonpositive quantities use DomainError; Decimal parsing can also throw.
 */
export function convert(
  quantity: string,
  from: string,
  to: string,
  pack?: string,
): string {
  const q = new Decimal(quantity);
  if (!q.isFinite() || q.lte(0))
    throw new DomainError("quantity", "Invalid quantity");
  if (from === to) return q.toString();
  if ((from === "kg" && to === "g") || (from === "l" && to === "ml"))
    return q.mul(1000).toString();
  if (from === "pack" && pack && new Decimal(pack).gt(0))
    return q.mul(pack).toString();
  throw new DomainError("unit", "Explicit compatible conversion required");
}

/**
 * Resolve already schema-parsed inputs to one serving; input.quantity is not a
 * multiplier here. Order totals and inventory consumption apply the item count.
 * Size recipe/price comes first, then ordered choices, then final-quantity edits.
 *
 * Callers may supply historical product/ingredient definitions and pricing policy.
 * This checks supplied availability, not current database state. The returned
 * snapshot retains supplied object references; it is not a frozen deep copy.
 * Business checks use DomainError; malformed numeric strings can fail in Decimal.
 */
export function resolve(
  product: Product,
  ingredients: Ingredient[],
  input: Customization,
  policy: Policy,
  policyVersion: number,
): Snapshot {
  if (!product.active || !product.available)
    throw new DomainError("unavailable", "Product unavailable");

  // Serving recipe and price
  const sizes = product.sizes ?? [];

  const size =
    sizes.find((s) => s.id === input.sizeId) ??
    (!input.sizeId && sizes.length === 1 ? sizes[0] : undefined);
  if ((input.sizeId || sizes.length) && !size)
    throw new DomainError("size", "Choose an available serving size");
  const amounts: Record<string, Decimal> = {};
  for (const [id, q] of Object.entries(size?.recipe ?? product.recipe))
    amounts[id] = new Decimal(q);
  let price = new Decimal(size?.price ?? product.price);

  // Ordered choices; size-specific effects replace each choice's base effects.
  for (const key of Object.keys(input.choices))
    if (!product.groups.some((g) => g.id === key))
      throw new DomainError("option", "Unknown option group");
  for (const group of product.groups) {
    const selected = input.choices[group.id] ?? group.defaultChoice;
    if (!selected) {
      if (group.required)
        throw new DomainError(
          "required",
          `Choose ${group.name.en || group.name.de}`,
        );
      continue;
    }

    const choice = group.choices.find((c) => c.id === selected);
    if (!choice) throw new DomainError("option", "Unknown option");
    price = price.plus(choice.adjustment);
    for (const effect of size?.effects[group.id]?.[choice.id] ??
      choice.effects) {
      const current = amounts[effect.ingredientId] ?? new Decimal(0);
      amounts[effect.ingredientId] =
        effect.kind === "replace"
          ? new Decimal(effect.quantity)
          : effect.kind === "add"
            ? current.plus(effect.quantity)
            : current.minus(effect.quantity);
    }
  }
  if (Object.values(amounts).some((q) => q.lt(0)))
    throw new DomainError(
      "effect",
      "Option effects result in negative quantities",
    );

  // Explicit edits set final quantities after all choices.
  const seen = new Set<string>();
  for (const edit of input.edits) {
    if (seen.has(edit.ingredientId))
      throw new DomainError("edit", "Duplicate ingredient edit");
    seen.add(edit.ingredientId);

    const ingredient = ingredients.find((i) => i.id === edit.ingredientId);
    if (!ingredient?.active)
      throw new DomainError("ingredient", "Ingredient unavailable");
    const target = new Decimal(edit.quantity),
      previous = amounts[ingredient.id] ?? new Decimal(0),
      delta = target.minus(previous);
    const portion = edit.portionId
      ? ingredient.portions.find((p) => p.id === edit.portionId)
      : ingredient.portions[0];
    if (edit.portionId && !portion)
      throw new DomainError("portion", "Unknown portion");
    if (portion && delta.gt(0))
      price = price.plus(
        new Decimal(portion.surcharge).mul(
          policy.additionPricing === "proportional"
            ? delta.div(portion.quantity)
            : delta.div(portion.quantity).ceil(),
        ),
      );
    if (
      portion &&
      delta.lt(0) &&
      policy.removalPricing === "proportional-refund"
    )
      price = price.plus(
        new Decimal(portion.surcharge).mul(delta.div(portion.quantity)),
      );
    amounts[ingredient.id] = target;
  }

  // Validate final quantities and collect cost/allergen evidence.
  const used: Ingredient[] = [];
  const resolved: Record<string, string> = {};
  let cost: Decimal | null = new Decimal(0);
  for (const [id, q] of Object.entries(amounts)) {
    if (q.isZero()) continue;

    const ingredient = ingredients.find((i) => i.id === id);
    if (!ingredient?.active)
      throw new DomainError("ingredient", `Ingredient ${id} unavailable`);
    if (q.lt(0) || q.decimalPlaces() > 3 || q.gt("999999999"))
      throw new DomainError("quantity", "Invalid resolved quantity");
    if (ingredient.unit === "piece" && !ingredient.fractional && !q.isInteger())
      throw new DomainError("quantity", "Whole pieces required");
    used.push(ingredient);
    resolved[id] = q.toString();
    if (ingredient.cost === null) cost = null;
    else if (cost) cost = cost.plus(q.mul(ingredient.cost));
  }

  // Clamp/round the per-serving price; missing ingredient costs make cost unknown.
  return {
    product,
    ingredients: ingredients.filter((i) => i.id in amounts),
    resolved,
    unitPrice: Decimal.max(0, price).toFixed(
      2,
      policy.rounding === "half-up"
        ? Decimal.ROUND_HALF_UP
        : Decimal.ROUND_HALF_EVEN,
    ),
    allergens: [...new Set(used.flatMap((i) => i.allergens ?? []))],
    incompleteAllergens: used.some((i) => i.allergens === null),
    referenceCost: cost?.toFixed(2) ?? null,
    policyVersion,
    pricingPolicy: {
      rounding: policy.rounding,
      additionPricing: policy.additionPricing,
      removalPricing: policy.removalPricing,
    },
  };
}
