/**
 * Pure catalog calculation tests using shared schema fixtures and policies.
 * The API resolver is exercised directly for units, recipes, choices, pricing,
 * and serving sizes, without HTTP requests or database persistence.
 */
import { describe, expect, it } from "vitest";
import { convert, resolve } from "../apps/api/src/catalog/resolve";
import { defaultPolicy } from "../packages/config/src/index";
import {
  customizationSchema,
  ingredientSchema,
  productSchema,
} from "../packages/contracts/src/index";

const n = { de: "Zutat", en: "Ingredient" };
const ingredients = [
  ingredientSchema.parse({
    id: "juice",
    name: n,
    unit: "ml",
    allergens: [],
    cost: "0.001",
  }),
  ingredientSchema.parse({
    id: "water",
    name: n,
    unit: "ml",
    allergens: null,
    portions: [{ id: "glass", name: n, quantity: "250", surcharge: "1.25" }],
  }),
];
const product = productSchema.parse({
  id: "drink",
  name: n,
  category: "drinks",
  price: "4.50",
  station: "bar",
  recipe: { juice: "500" },
  groups: [
    {
      id: "style",
      name: n,
      required: true,
      choices: [
        {
          id: "mixed",
          name: n,
          effects: [
            { ingredientId: "juice", kind: "replace", quantity: "250" },
            { ingredientId: "water", kind: "add", quantity: "250" },
          ],
        },
      ],
    },
  ],
});
const input = customizationSchema.parse({
  productId: "drink",
  quantity: 1,
  choices: { style: "mixed" },
});
describe("exact domain calculations", () => {
  it("converts compatible units and explicit packs", () => {
    expect(convert("0.125", "kg", "g")).toBe("125");
    expect(convert("1.5", "l", "ml")).toBe("1500");
    expect(convert("2", "pack", "ml", "6000")).toBe("12000");
    expect(() => convert("1", "g", "ml")).toThrow();
  });
  it("resolves substitutions without changing the base recipe", () => {
    const result = resolve(product, ingredients, input, defaultPolicy, 1);
    expect(result.resolved).toEqual({ juice: "250", water: "250" });
    expect(product.recipe).toEqual({ juice: "500" });
    expect(result.incompleteAllergens).toBe(true);
    expect(result.referenceCost).toBeNull();
  });
  it("requires choices and rejects unknown choices", () => {
    expect(() =>
      resolve(
        product,
        ingredients,
        { ...input, choices: {} },
        defaultPolicy,
        1,
      ),
    ).toThrow("Choose");
    expect(() =>
      resolve(
        product,
        ingredients,
        { ...input, choices: { style: "bad" } },
        defaultPolicy,
        1,
      ),
    ).toThrow("Unknown");
  });
  it("applies edits after options and does not refund removals by default", () => {
    const result = resolve(
      product,
      ingredients,
      {
        ...input,
        edits: [
          { ingredientId: "juice", quantity: "0" },
          { ingredientId: "water", quantity: "500", portionId: "glass" },
        ],
      },
      defaultPolicy,
      1,
    );
    expect(result.resolved).toEqual({ water: "500" });
    expect(result.unitPrice).toBe("5.75");
  });
  it("supports configurable proportional pricing and rounding", () => {
    const i = { ...input, edits: [{ ingredientId: "water", quantity: "251" }] };
    expect(
      resolve(
        product,
        ingredients,
        i,
        { ...defaultPolicy, additionPricing: "proportional" },
        2,
      ).unitPrice,
    ).toBe("4.51");
    expect(
      resolve(
        product,
        ingredients,
        i,
        {
          ...defaultPolicy,
          additionPricing: "proportional",
          rounding: "half-even",
        },
        2,
      ).unitPrice,
    ).toBe("4.50");
  });
  it("rejects negative effects, fractional whole pieces, duplicate edits", () => {
    const bad = {
      ...product,
      groups: [
        {
          ...product.groups[0]!,
          choices: [
            {
              id: "mixed",
              name: n,
              adjustment: "0",
              effects: [
                {
                  ingredientId: "juice",
                  kind: "remove" as const,
                  quantity: "501",
                },
              ],
            },
          ],
        },
      ],
    };
    expect(() => resolve(bad, ingredients, input, defaultPolicy, 1)).toThrow(
      "negative",
    );
    expect(() =>
      resolve(
        product,
        [
          { ...ingredients[0]!, unit: "piece", fractional: false },
          ingredients[1]!,
        ],
        { ...input, edits: [{ ingredientId: "juice", quantity: "0.5" }] },
        defaultPolicy,
        1,
      ),
    ).toThrow("Whole");
    expect(() =>
      resolve(
        product,
        ingredients,
        {
          ...input,
          edits: [
            { ingredientId: "juice", quantity: "1" },
            { ingredientId: "juice", quantity: "2" },
          ],
        },
        defaultPolicy,
        1,
      ),
    ).toThrow("Duplicate");
  });
});

it("resolves explicit serving recipes and preparation effects without scaling legacy prices", () => {
  const sized = productSchema.parse({
    ...product,
    sizes: [
      {
        id: "small",
        name: n,
        price: "3.25",
        recipe: { juice: "250" },
        effects: {
          style: {
            mixed: [
              { ingredientId: "juice", kind: "replace", quantity: "125" },
              { ingredientId: "water", kind: "add", quantity: "125" },
            ],
          },
        },
      },
      { id: "large", name: n, price: "4.50", recipe: { juice: "500" } },
    ],
  });
  const small = resolve(
    sized,
    ingredients,
    { ...input, sizeId: "small", quantity: 2 },
    defaultPolicy,
    1,
  );
  expect(small.resolved).toEqual({ juice: "125", water: "125" });
  expect(small.unitPrice).toBe("3.25");
  expect(
    resolve(sized, ingredients, { ...input, sizeId: "large" }, defaultPolicy, 1)
      .resolved,
  ).toEqual({ juice: "250", water: "250" });
  expect(() => resolve(sized, ingredients, input, defaultPolicy, 1)).toThrow(
    "size",
  );
  expect(() =>
    resolve(
      sized,
      ingredients,
      { ...input, sizeId: "removed" },
      defaultPolicy,
      1,
    ),
  ).toThrow("size");
  expect(resolve(product, ingredients, input, defaultPolicy, 1).unitPrice).toBe(
    "4.50",
  );
});
