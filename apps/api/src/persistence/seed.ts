/**
 * Development/demo provisioning through seed, with its own transaction.
 * Conflict-ignore inserts preserve existing rows but can recreate missing demo data.
 */
import argon2 from "argon2";
import { defaultPolicy } from "../../../../packages/config/src/index";
import {
  ingredientSchema,
  productSchema,
  tableSchema,
} from "../../../../packages/contracts/src/index";
import { env, pool, transaction } from "./db";

const n = (de: string, en: string) => ({ de, en });

/**
 * Insert missing demo users, policy, catalog and opening movements with stable ids.
 * Shares an initialization lock with bootstrapAdmin. Existing rows are not updated;
 * re-running can restore deleted demo rows. This is not production initialization.
 */
export async function seed() {
  const password = await argon2.hash(
    env.DEMO_PASSWORD ?? "local-demo-change-me",
  );
  await transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(812732)");
    for (const role of ["manager", "waiter", "kitchen", "bar"])
      await tx.query(
        "INSERT INTO users(id,username,password,role,preferences) VALUES($1,$1,$2,$1,$3) ON CONFLICT DO NOTHING",
        [role, password, defaultPolicy.display],
      );
    await tx.query(
      "INSERT INTO configuration(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING",
      [
        {
          ...defaultPolicy,
          categories: [
            { id: "food", name: n("Speisen", "Food"), quick: ["cheese"] },
            { id: "drinks", name: n("Getränke", "Drinks"), quick: [] },
          ],
        },
      ],
    );
    // Demo catalog and fixed opening-movement ids
    const ingredients = [
      {
        id: "bun",
        name: n("Brötchen", "Bun"),
        unit: "piece",
        allergens: ["gluten"],
        cost: "0.5",
      },
      {
        id: "patty",
        name: n("Rindfleisch", "Beef patty"),
        unit: "g",
        allergens: [],
        cost: "0.012",
      },
      {
        id: "onion",
        name: n("Zwiebeln", "Onions"),
        unit: "g",
        allergens: [],
        cost: "0.001",
      },
      {
        id: "cheese",
        name: n("Käse", "Cheese"),
        unit: "g",
        allergens: ["milk"],
        cost: "0.01",
        portions: [
          {
            id: "slice",
            name: n("Scheibe 20 g", "Slice 20 g"),
            quantity: "20",
            surcharge: "1",
          },
        ],
      },
      {
        id: "pickle",
        name: n("Essiggurken", "Pickles"),
        unit: "g",
        allergens: null,
        portions: [
          {
            id: "small",
            name: n("Portion 15 g", "Portion 15 g"),
            quantity: "15",
            surcharge: "0",
          },
        ],
      },
      {
        id: "juice",
        name: n("Apfelsaft", "Apple juice"),
        unit: "ml",
        allergens: [],
        cost: "0.002",
      },
      {
        id: "still",
        name: n("Stilles Wasser", "Still water"),
        unit: "ml",
        allergens: [],
        cost: "0.001",
      },
      {
        id: "sparkling",
        name: n("Mineralwasser", "Sparkling water"),
        unit: "ml",
        allergens: [],
        cost: "0.001",
      },
    ];
    for (const entry of ingredients) {
      const i = ingredientSchema.parse({
        ...entry,
        category: ["juice", "still", "sparkling"].includes(entry.id)
          ? "drinks"
          : "food",
        threshold: "100",
      });
      await tx.query(
        "INSERT INTO catalog(kind,id,data) VALUES('ingredient',$1,$2) ON CONFLICT DO NOTHING",
        [i.id, i],
      );
      await tx.query(
        "INSERT INTO movements(id,ingredient_id,quantity,kind,reason,actor) VALUES($1,$2,$3,'opening','Demo opening balance','manager') ON CONFLICT DO NOTHING",
        ["seed-" + i.id, i.id, i.unit === "piece" ? "100" : "10000"],
      );
    }
    const products = [
      {
        id: "burger",
        name: n("Hausburger", "House burger"),
        category: "food",
        recipe: { bun: "1", patty: "150", onion: "20" },
        price: "12.50",
        station: "kitchen",
        quick: ["cheese"],
      },
      {
        id: "apple",
        name: n("Apfelsaft 0,5 l", "Apple juice 500 ml"),
        category: "drinks",
        recipe: { juice: "500" },
        price: "4.50",
        station: "bar",
        guided: true,
        groups: [
          {
            id: "style",
            name: n(
              "Wie möchtest du den Saft?",
              "How would you like your juice?",
            ),
            required: true,
            choices: [
              { id: "pure", name: n("Pur", "Pure juice"), effects: [] },
              {
                id: "still",
                name: n("Still", "Still water"),
                effects: [
                  { ingredientId: "juice", kind: "replace", quantity: "250" },
                  { ingredientId: "still", kind: "add", quantity: "250" },
                ],
              },
              {
                id: "sparkling",
                name: n("Sprudel", "Sparkling"),
                effects: [
                  { ingredientId: "juice", kind: "replace", quantity: "250" },
                  { ingredientId: "sparkling", kind: "add", quantity: "250" },
                ],
              },
            ],
          },
        ],
      },
    ];

    // Separate size demo: do not retrofit commercial sizes onto an existing row.
    const demo = productSchema.parse(products.find((p) => p.id === "apple"));
    const sizedDemo = productSchema.parse({
      ...demo,
      id: "apple-sizes-demo",
      name: n("Apfelsaft – Größen-Demo", "Apple juice – size demo"),
      sizes: [
        {
          id: "small",
          name: n("Klein", "Small"),
          volume: "250 ml",
          price: "3.00",
          recipe: { juice: "250" },
          effects: {
            style: {
              still: [
                { ingredientId: "juice", kind: "replace", quantity: "125" },
                { ingredientId: "still", kind: "add", quantity: "125" },
              ],
              sparkling: [
                { ingredientId: "juice", kind: "replace", quantity: "125" },
                { ingredientId: "sparkling", kind: "add", quantity: "125" },
              ],
            },
          },
        },
        {
          id: "large",
          name: n("Groß", "Large"),
          volume: "500 ml",
          price: "4.50",
          recipe: { juice: "500" },
          effects: {},
        },
      ],
    });
    for (const entry of [...products, sizedDemo]) {
      const p = productSchema.parse(entry);
      await tx.query(
        "INSERT INTO catalog(kind,id,data) VALUES('product',$1,$2) ON CONFLICT DO NOTHING",
        [p.id, p],
      );
    }
    for (let number = 1; number <= 2; number++) {
      const t = tableSchema.parse({
        id: "t" + number,
        number: String(number),
        area: "Terrasse",
        x: 10 + (number - 1) * 45,
        y: 25,
      });
      await tx.query(
        "INSERT INTO catalog(kind,id,data) VALUES('table',$1,$2) ON CONFLICT DO NOTHING",
        [t.id, t],
      );
    }
  });
}

if (process.argv[1]?.endsWith("seed.ts")) {
  await seed();
  await pool.end();
}
