/**
 * Shared schemas, transport-facing types and small label/default helpers.
 * Used by API, browser and config; reference checks and pricing live in API services.
 */
import { z } from "zod";

/**
 * Nonnegative quantities are decimal strings with up to three fractional digits.
 */
export const decimal = z.string().regex(/^(0|[1-9]\d{0,8})(\.\d{1,3})?$/);

export const positive = decimal.refine(
  (v) => Number(v) > 0,
  "Must be positive",
);

/**
 * Signed decimal strings with up to two fractional digits; product/size schemas
 * add nonnegative checks, while adjustments may remain negative.
 */
export const money = z.string().regex(/^-?(0|[1-9]\d{0,7})(\.\d{1,2})?$/);

export const name = z
  .object({ de: z.string().max(200), en: z.string().max(200) })
  .refine(
    (v) => Boolean(v.de.trim() || v.en.trim()),
    "A translation is required",
  );

// Catalog structures
export const portionSchema = z.object({
  id: z.string().min(1),
  name,
  quantity: positive,
  surcharge: money.default("0"),
});

export const ingredientSchema = z.object({
  id: z.string().min(1),
  name,
  unit: z.enum(["g", "ml", "piece"]),
  category: z.string().default(""),
  active: z.boolean().default(true),
  fractional: z.boolean().default(false),
  cost: decimal.nullable().default(null),
  allergens: z.array(z.string()).nullable().default(null),
  threshold: decimal.nullable().default(null),
  portions: z.array(portionSchema).default([]),
});

export const effectSchema = z.object({
  ingredientId: z.string(),
  kind: z.enum(["add", "remove", "replace"]),
  quantity: decimal,
});

export const choiceSchema = z.object({
  id: z.string(),
  name,
  effects: z.array(effectSchema),
  adjustment: money.default("0"),
});

export const groupSchema = z.object({
  id: z.string(),
  name,
  required: z.boolean(),
  defaultChoice: z.string().nullable().default(null),
  choices: z.array(choiceSchema).min(1),
});

export const servingSizeSchema = z.object({
  id: z.string().min(1),
  name,
  volume: z.string().max(100).optional(),
  recipe: z.record(z.string(), positive),
  price: money.refine((v) => Number(v) >= 0),
  // Full effects per group/choice for this size; omitted entries retain base effects.
  effects: z
    .record(z.string(), z.record(z.string(), z.array(effectSchema)))
    .default({}),
});

export const productSchema = z.object({
  id: z.string().min(1),
  name,
  description: name.optional(),
  category: z.string(),
  recipe: z.record(z.string(), positive),
  price: money.refine((v) => Number(v) >= 0),
  station: z.enum(["kitchen", "bar"]),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
  guided: z.boolean().default(false),
  groups: z.array(groupSchema).default([]),
  sizes: z.array(servingSizeSchema).default([]),
  quick: z.array(z.string()).nullable().default(null),
});

export const tableSchema = z.object({
  id: z.string(),
  number: z.string().min(1),
  area: z.string(),
  x: z.number().min(0).max(90),
  y: z.number().min(0).max(90),
  active: z.boolean().default(true),
});

export const editSchema = z.object({
  ingredientId: z.string(),
  quantity: decimal,
  portionId: z.string().optional(),
});

// Order input and user preferences
export const customizationSchema = z.object({
  sizeId: z.string().optional(),
  productId: z.string(),
  quantity: z.number().int().min(1).max(100),
  choices: z.record(z.string(), z.string()).default({}),
  edits: z.array(editSchema).default([]),
  note: z.string().max(1000).default(""),
});

export const preferencesSchema = z.object({
  language: z.enum(["de", "en"]).default("de"),
  tables: z.enum(["list", "map"]).default("list"),
  menu: z.enum(["list", "tiles"]).default("tiles"),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  favorites: z.array(z.string()).default([]),
});
// Transport-facing types; these declarations do not validate incoming JSON.
export type Ingredient = z.infer<typeof ingredientSchema>;
export type Product = z.infer<typeof productSchema>;
export type Customization = z.infer<typeof customizationSchema>;
export type Table = z.infer<typeof tableSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type Role = "manager" | "waiter" | "kitchen" | "bar";
export type User = {
  id: string;
  username: string;
  role: Role;
  preferences: Preferences;
};
export type State =
  "draft" | "submitted" | "preparing" | "ready" | "served" | "cancelled";
/**
 * Captured definitions and calculated per-serving values. This is a structural
 * type, not a runtime validator or an immutable/frozen object.
 */
export type Snapshot = {
  product: Product;
  ingredients: Ingredient[];
  resolved: Record<string, string>;
  unitPrice: string;
  allergens: string[];
  incompleteAllergens: boolean;
  referenceCost: string | null;
  policyVersion: number;
  pricingPolicy: {
    rounding: "half-up" | "half-even";
    additionPricing: "per-portion" | "proportional";
    removalPricing: "no-refund" | "proportional-refund";
  };
};
export type Line = {
  id: string;
  orderId: string;
  tableId: string;
  version: number;
  state: State;
  input: Customization;
  snapshot: Snapshot;
  createdBy: string;
  changedBy: string;
  createdAt: string;
  updatedAt: string;
  reason: string | null;
  replacementOf: string | null;
};
export type Order = {
  id: string;
  tableId: string;
  closedAt: string | null;
  total: string;
};
export type History = {
  id: string;
  lineId: string | null;
  actor: string;
  action: string;
  at: string;
  detail: unknown;
};
export type Movement = {
  id: string;
  ingredientId: string;
  quantity: string;
  kind: string;
  reason: string;
  actor: string;
  at: string;
  lineId: string | null;
};

/**
 * Use the requested translation, falling back to the other when it is empty.
 */
export const label = (n: { de: string; en: string }, language: "de" | "en") =>
  n[language] || n[language === "de" ? "en" : "de"];

/**
 * Return a customization with manager defaults overlaid by explicit choices and
 * a single size selected when absent. Does not validate ids, resolve quantities or
 * calculate prices; callers perform schema/business validation separately.
 */
export function withChoiceDefaults(
  input: Customization,
  product: Product,
): Customization {
  return {
    ...input,
    ...(!input.sizeId && product.sizes?.length === 1
      ? { sizeId: product.sizes[0]!.id }
      : {}),
    choices: {
      ...Object.fromEntries(
        product.groups
          .filter((group) => group.defaultChoice)
          .map((group) => [group.id, group.defaultChoice!]),
      ),
      ...input.choices,
    },
  };
}
