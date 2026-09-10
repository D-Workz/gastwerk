/**
 * Fastify/PostgreSQL workflow tests using app.inject and seeded role sessions.
 * Setup requires a connection string containing venue_test, and each test
 * truncates operational tables. Run with the integration test configuration.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../apps/api/src/app";
import { pool } from "../apps/api/src/persistence/db";
import { migrate } from "../apps/api/src/persistence/migrate";
import { seed } from "../apps/api/src/persistence/seed";
import { bootstrapAdmin } from "../apps/api/src/deployment/bootstrap";
import type { AppState } from "../apps/web/src/shared/api/api";

const app = await buildApp();
const cookies: Record<string, string> = {};

/**
 * Inject a request with the selected role session. Pass an explicit key when
 * testing retries; the default creates a distinct intentional request.
 */
async function request(
  role: string,
  path: string,
  body?: unknown,
  key = randomUUID(),
) {
  return app.inject({
    method: body === undefined ? "GET" : "POST",
    url: "/api" + path,
    headers: {
      cookie: cookies[role] ?? "",
      "x-requested-with": "venue",
      "idempotency-key": key,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
}

async function state() {
  return (await request("manager", "/state")).json<AppState>();
}

async function add(product = "apple", quantity = 1) {
  const r = await request("waiter", "/lines", {
    tableId: "t1",
    input: {
      productId: product,
      quantity,
      choices: product === "apple" ? { style: "sparkling" } : {},
      edits: [],
      note: "Cut in half",
    },
  });
  expect(r.statusCode).toBe(200);
  return r.json<{ id: string }>().id;
}

async function transition(
  id: string,
  version: number,
  target: string,
  role = "waiter",
  key = randomUUID(),
  reason = "Test cancellation",
) {
  return request(
    role,
    `/lines/${id}/transition`,
    { version, state: target, reason },
    key,
  );
}

beforeAll(async () => {
  if (!pool.options.connectionString?.includes("venue_test"))
    throw new Error(
      "Integration tests require the isolated venue_test database",
    );
  await migrate();
  await seed();
  for (const role of ["manager", "waiter", "kitchen", "bar"]) {
    const r = await request(role, "/login", {
      username: role,
      password: "local-demo-change-me",
    });
    expect(r.statusCode).toBe(200);
    cookies[role] = r.cookies.map((c) => `${c.name}=${c.value}`).join(";");
  }
});
beforeEach(async () => {
  await pool.query("TRUNCATE requests,history,movements,lines,orders CASCADE");
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
describe("PostgreSQL workflows and integrity", () => {
  it("enforces direct API permissions, authentication, CSRF and validation", async () => {
    expect(
      (
        await request("waiter", "/inventory", {
          ingredientId: "juice",
          quantity: "100",
          unit: "ml",
          kind: "delivery",
          reason: "x",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request("bar", "/lines", {
          tableId: "t1",
          input: { productId: "burger", quantity: 1 },
        })
      ).statusCode,
    ).toBe(403);
    expect((await request("nobody", "/state")).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/login",
          payload: { username: "waiter", password: "x" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request("waiter", "/lines", {
          tableId: "t1",
          input: { productId: "apple", quantity: 1 },
        })
      ).statusCode,
    ).toBe(400);
    expect((await state()).lines).toHaveLength(0);
  });
  it("consumes once under simultaneous retries and rejects stale revisions", async () => {
    const id = await add();
    expect(
      (await request("bar", "/state")).json<AppState>().lines,
    ).toHaveLength(0);
    await transition(id, 1, "submitted");
    const key = randomUUID();
    const results = await Promise.all([
      transition(id, 2, "preparing", "bar", key),
      transition(id, 2, "preparing", "bar", key),
      transition(id, 2, "preparing", "bar"),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 200, 409]);
    const s = await state();
    expect(s.balances).toEqual({ juice: "-250.000", sparkling: "-250.000" });
    expect((await pool.query("SELECT * FROM movements")).rows).toHaveLength(2);
    await transition(id, 3, "ready", "bar");
    await transition(id, 4, "served");
    expect((await state()).balances).toEqual(s.balances);
    const order = s.orders[0]!;
    expect(
      (await request("waiter", `/orders/${order.id}/close`, {})).statusCode,
    ).toBe(200);
    await add();
    expect((await state()).orders).toHaveLength(2);
  });
  it("rolls back state and all stock when a consumption insert fails", async () => {
    const id = await add();
    await transition(id, 1, "submitted");
    await pool.query(
      `CREATE OR REPLACE FUNCTION fail_consumption() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.ingredient_id='sparkling' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_failure BEFORE INSERT ON movements FOR EACH ROW EXECUTE FUNCTION fail_consumption()`,
    );
    try {
      expect((await transition(id, 2, "preparing", "bar")).statusCode).toBe(
        500,
      );
      expect((await state()).lines[0]?.state).toBe("submitted");
      expect((await pool.query("SELECT * FROM movements")).rows).toHaveLength(
        0,
      );
    } finally {
      await pool.query(
        "DROP TRIGGER test_failure ON movements; DROP FUNCTION fail_consumption()",
      );
    }
  });
  it("preserves concurrent additions and deduplicates add/send requests", async () => {
    const key = randomUUID(),
      body = { tableId: "t1", input: { productId: "burger", quantity: 1 } };
    const results = await Promise.all([
      request("waiter", "/lines", body, key),
      request("waiter", "/lines", body, key),
      request("manager", "/lines", body),
    ]);
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    const s = await state();
    expect(s.orders).toHaveLength(1);
    expect(s.lines).toHaveLength(2);
    const send = {
        lines: s.lines.map((l) => ({ id: l.id, version: l.version })),
      },
      sendKey = randomUUID();
    await request("waiter", `/orders/${s.orders[0]!.id}/send`, send, sendKey);
    expect(
      (
        await request(
          "waiter",
          `/orders/${s.orders[0]!.id}/send`,
          send,
          sendKey,
        )
      ).statusCode,
    ).toBe(200);
    expect((await state()).lines.every((l) => l.version === 2)).toBe(true);
    expect(
      (await request("waiter", "/lines", { ...body, tableId: "t2" }, key))
        .statusCode,
    ).toBe(409);
  });
  it("makes amendments visible, splits quantities and preserves attribution", async () => {
    const id = await add("burger", 2);
    await transition(id, 1, "submitted");
    const input = {
      productId: "burger",
      quantity: 1,
      choices: {},
      edits: [{ ingredientId: "onion", quantity: "0" }],
      note: "One only",
    };
    const response = await request("manager", `/lines/${id}/edit`, {
      version: 2,
      input,
      split: true,
    });
    expect(response.statusCode).toBe(200);
    const s = await state();
    expect(s.lines).toHaveLength(2);
    expect(s.lines.map((l) => l.input.quantity)).toEqual([1, 1]);
    expect(s.lines.every((l) => l.createdBy === "waiter")).toBe(true);
    expect((await transition(id, 2, "preparing", "kitchen")).statusCode).toBe(
      409,
    );
    expect(
      (await request("waiter", `/lines/${id}/edit`, { version: 2, input }))
        .statusCode,
    ).toBe(409);
  });
  it("retains consumption on cancellation and replacement, rejects unfinished close", async () => {
    const id = await add("burger");
    await transition(id, 1, "submitted");
    expect((await transition(id, 2, "cancelled")).statusCode).toBe(200);
    expect((await state()).balances).toEqual({});
    const second = await add();
    await transition(second, 1, "submitted");
    await transition(second, 2, "preparing", "bar");
    const before = (await state()).balances;
    const r = await request("waiter", `/lines/${second}/replace`, {
      version: 3,
      reason: "Guest changed request",
      input: { productId: "apple", quantity: 1, choices: { style: "pure" } },
    });
    expect(r.statusCode).toBe(200);
    const s = await state();
    expect(s.balances).toEqual(before);
    expect(s.lines.find((l) => l.id === second)?.state).toBe("cancelled");
    expect(s.lines.find((l) => l.replacementOf === second)?.state).toBe(
      "submitted",
    );
    expect(
      (await request("waiter", `/orders/${s.orders[0]!.id}/close`, {}))
        .statusCode,
    ).toBe(409);
  });
  it("keeps historical catalog snapshots and version-checks manager edits", async () => {
    const id = await add("burger");
    const s = await state(),
      product = s.products.find((p) => p.id === "burger")!;
    const { version, ...data } = product;
    const update = {
      data: { ...data, price: "99.00", recipe: { bun: "2" } },
      version,
    };
    expect(
      (await request("manager", "/catalog/product", update)).statusCode,
    ).toBe(200);
    expect(
      (await request("manager", "/catalog/product", update)).statusCode,
    ).toBe(409);
    expect(
      (await state()).lines.find((l) => l.id === id)?.snapshot.unitPrice,
    ).toBe("12.50");
    await request("manager", "/catalog/product", {
      data,
      version: version + 1,
    });
  });
  it("repeated migrations and seeds preserve existing records", async () => {
    const id = await add();
    await migrate();
    await seed();
    await seed();
    expect((await state()).lines.some((l) => l.id === id)).toBe(true);
    expect(
      (await pool.query("SELECT * FROM movements WHERE id='seed-juice'"))
        .rowCount,
    ).toBe(1);
  });
});

describe("policy and historical invariants", () => {
  it("keeps existing pricing policy and archived ingredients when editing a note", async () => {
    const id = await add("burger");
    let s = await state();

    const original = s.lines.find((l) => l.id === id)!;

    const ingredient = s.ingredients.find((i) => i.id === "onion")!;
    const { version, ...data } = ingredient;
    expect(
      (
        await request("manager", "/catalog/ingredient", {
          data: { ...data, active: false },
          version,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request("manager", "/configuration", {
          version: s.configuration.version,
          data: {
            ...s.configuration.policy,
            additionPricing: "proportional",
            rounding: "half-even",
          },
        })
      ).statusCode,
    ).toBe(200);
    const input = { ...original.input, note: "Historical edit" };
    expect(
      (await request("waiter", `/lines/${id}/edit`, { version: 1, input }))
        .statusCode,
    ).toBe(200);
    s = await state();

    const edited = s.lines.find((l) => l.id === id)!;
    expect(edited.snapshot.unitPrice).toBe(original.snapshot.unitPrice);
    expect(edited.snapshot.policyVersion).toBe(original.snapshot.policyVersion);
    expect(edited.snapshot.resolved.onion).toBe("20");
    const preview = await request("waiter", "/preview", { lineId: id, input });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().unitPrice).toBe(original.snapshot.unitPrice);
    await request("manager", "/catalog/ingredient", {
      data,
      version: version + 1,
    });
    await request("manager", "/configuration", {
      version: s.configuration.version,
      data: {
        ...s.configuration.policy,
        additionPricing: "per-portion",
        rounding: "half-up",
      },
    });
  });
  it("only a manager may correct served lines and stock is retained", async () => {
    const id = await add();
    await transition(id, 1, "submitted");
    await transition(id, 2, "preparing", "bar");
    await transition(id, 3, "ready", "bar");
    await transition(id, 4, "served");
    const before = (await state()).balances;
    expect((await transition(id, 5, "cancelled", "waiter")).statusCode).toBe(
      403,
    );
    expect(
      (await transition(id, 5, "cancelled", "manager", randomUUID(), "x"))
        .statusCode,
    ).toBe(400);
    expect((await transition(id, 5, "cancelled", "manager")).statusCode).toBe(
      200,
    );
    expect((await state()).balances).toEqual(before);
  });
  it("races edits without losing updates and rejects incompatible conversions", async () => {
    const id = await add("burger");
    const input = {
      productId: "burger",
      quantity: 1,
      choices: {},
      edits: [],
      note: "Update",
    };
    const results = await Promise.all([
      request("waiter", `/lines/${id}/edit`, { version: 1, input }),
      request("manager", `/lines/${id}/edit`, {
        version: 1,
        input: { ...input, note: "Other" },
      }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      (
        await request("manager", "/inventory", {
          ingredientId: "juice",
          quantity: "1",
          unit: "kg",
          kind: "delivery",
          reason: "Invalid conversion",
        })
      ).statusCode,
    ).toBe(400);
    expect((await state()).balances).toEqual({});
  });
  it("persists user display settings independently", async () => {
    const s = await state();
    const prefs = {
      ...s.user.preferences,
      language: "en",
      menu: "list",
      tables: "map",
      favorites: ["burger"],
    };
    expect((await request("waiter", "/preferences", prefs)).statusCode).toBe(
      200,
    );
    expect((await request("waiter", "/me")).json().preferences).toEqual(prefs);
    expect((await request("manager", "/me")).json().preferences.language).toBe(
      "de",
    );
  });
});

describe("milestone two repeat, size and note contracts", () => {
  it("counts concurrent intentional repeats across sessions and deduplicates retries", async () => {
    const id = await add();

    const line = (await state()).lines.find((l) => l.id === id)!;
    const body = { input: line.input };
    const key = randomUUID();
    const responses = await Promise.all([
      request("waiter", `/lines/${id}/repeat`, body, key),
      request("waiter", `/lines/${id}/repeat`, body, key),
      request("manager", `/lines/${id}/repeat`, body),
      request("waiter", `/lines/${id}/repeat`, body),
    ]);
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200, 200, 200]);
    const s = await state();
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]!.input.quantity).toBe(4);
    expect(s.balances).toEqual({});
    expect((await request("bar", `/lines/${id}/repeat`, body)).statusCode).toBe(
      403,
    );
  });

  it("repeats sent configurations into unsent work and consumes only new work", async () => {
    const id = await add();
    await transition(id, 1, "submitted");
    await transition(id, 2, "preparing", "bar");
    const before = await state();

    const source = before.lines.find((l) => l.id === id)!;
    const body = { input: source.input };
    expect(
      (await request("waiter", `/lines/${id}/repeat`, body)).statusCode,
    ).toBe(200);
    expect(
      (await request("waiter", `/lines/${id}/repeat`, body)).statusCode,
    ).toBe(200);
    let s = await state();

    const repeated = s.lines.find((l) => l.id !== id)!;
    expect(repeated.input).toEqual({ ...source.input, quantity: 2 });
    expect(repeated.state).toBe("draft");
    expect(s.lines.find((l) => l.id === id)!.input.quantity).toBe(1);
    expect(s.balances).toEqual(before.balances);
    await request("waiter", `/orders/${repeated.orderId}/send`, {
      lines: [{ id: repeated.id, version: repeated.version }],
    });
    await transition(repeated.id, repeated.version + 1, "preparing", "bar");
    s = await state();
    expect(s.balances.juice).toBe("-750.000");
    expect(
      (await request("waiter", `/lines/${id}/decrement`, { version: 3 }))
        .statusCode,
    ).toBe(409);
  });

  it("requires review of changed prices and retains unlike notes and configurations", async () => {
    const id = await add("burger");
    const s = await state();

    const source = s.lines.find((l) => l.id === id)!;
    await request("waiter", "/lines", {
      tableId: "t1",
      input: { ...source.input, note: "Different note" },
    });
    await request("waiter", `/lines/${id}/repeat`, { input: source.input });
    expect((await state()).lines.map((l) => l.input.quantity).sort()).toEqual([
      1, 2,
    ]);

    const product = s.products.find((p) => p.id === "burger")!;
    const { version, ...data } = product;
    try {
      await request("manager", "/catalog/product", {
        version,
        data: { ...data, price: "88.00" },
      });
      const response = await request("waiter", `/lines/${id}/repeat`, {
        input: source.input,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe("repeat_review");
      expect((await state()).lines).toHaveLength(2);
    } finally {
      await request("manager", "/catalog/product", {
        version: version + 1,
        data,
      });
    }
  });

  it("supports recoverable zero decrement and revision checked note amendments", async () => {
    const id = await add("burger");
    expect(
      (await request("waiter", `/lines/${id}/decrement`, { version: 1 }))
        .statusCode,
    ).toBe(200);
    expect((await state()).lines[0]!.state).toBe("cancelled");
    expect(
      (await request("waiter", `/lines/${id}/undo-removal`, { version: 2 }))
        .statusCode,
    ).toBe(200);
    const line = (await state()).lines[0]!;
    const input = { ...line.input, note: "No salt" };
    expect(
      (await request("waiter", `/lines/${id}/edit`, { version: 3, input }))
        .statusCode,
    ).toBe(200);
    expect((await transition(id, 3, "submitted")).statusCode).toBe(409);
    await transition(id, 4, "submitted");
    expect(
      (await request("kitchen", "/state")).json<AppState>().lines[0]!.input
        .note,
    ).toBe("No salt");
    await transition(id, 5, "preparing", "kitchen");
    expect(
      (
        await request("waiter", `/lines/${id}/edit`, {
          version: 6,
          input: { ...input, note: "Late" },
        })
      ).statusCode,
    ).toBe(409);
  });

  it("multiplies configured serving quantities and prices by item count", async () => {
    const response = await request("waiter", "/lines", {
      tableId: "t1",
      input: {
        productId: "apple-sizes-demo",
        sizeId: "small",
        quantity: 2,
        choices: { style: "sparkling" },
      },
    });
    expect(response.statusCode).toBe(200);
    const id = response.json().id;
    let s = await state();
    expect(s.orders[0]!.total).toBe("6.00");
    expect(s.lines[0]!.snapshot.resolved).toEqual({
      juice: "125",
      sparkling: "125",
    });
    await transition(id, 1, "submitted");
    await transition(id, 2, "preparing", "bar");
    s = await state();
    expect(s.balances).toEqual({ juice: "-250.000", sparkling: "-250.000" });
  });
});

it("migration two preserves commercial data and custom labels while normalizing legacy records", async () => {
  const id = await add();
  const before = await state();

  const product = before.products.find((p) => p.id === "apple")!;
  const legacy = {
    ...product,
    sizes: undefined,
    groups: product.groups.map((g) => ({
      ...g,
      choices: g.choices.map((c) => ({
        ...c,
        name:
          c.id === "pure"
            ? { de: "Pur", en: "Pure" }
            : c.id === "sparkling"
              ? { de: "Eigener Name", en: "Custom label" }
              : c.name,
      })),
    })),
  };
  await pool.query(
    "UPDATE catalog SET data=$1 WHERE kind='product' AND id='apple'",
    [legacy],
  );
  await pool.query("DELETE FROM migrations WHERE version=2");
  try {
    await migrate();
    const after = await state();

    const migrated = after.products.find((p) => p.id === "apple")!;
    expect(migrated.sizes).toEqual([]);
    expect(migrated.recipe).toEqual(product.recipe);
    expect(migrated.price).toBe(product.price);
    expect(
      migrated.groups[0]!.choices.find((c) => c.id === "pure")!.name.en,
    ).toBe("Pure juice");
    expect(
      migrated.groups[0]!.choices.find((c) => c.id === "sparkling")!.name.en,
    ).toBe("Custom label");
    expect(after.lines.find((l) => l.id === id)!.snapshot).toEqual(
      before.lines.find((l) => l.id === id)!.snapshot,
    );
    expect(after.balances).toEqual(before.balances);
  } finally {
    const { version: _version, ...data } = product;
    await pool.query(
      "UPDATE catalog SET data=$1 WHERE kind='product' AND id='apple'",
      [data],
    );
  }
});

it("reports unready when the required migration or configuration is missing", async () => {
  const configuration = (
    await pool.query("SELECT * FROM configuration WHERE id=1")
  ).rows[0];
  expect((await request("manager", "/health")).statusCode).toBe(200);
  try {
    await pool.query("DELETE FROM configuration WHERE id=1");
    expect((await request("manager", "/health")).statusCode).toBe(503);
  } finally {
    await pool.query(
      "INSERT INTO configuration(id,data,version) VALUES(1,$1,$2)",
      [configuration.data, configuration.version],
    );
  }
  try {
    await pool.query("DELETE FROM migrations WHERE version=2");
    expect((await request("manager", "/health")).statusCode).toBe(503);
  } finally {
    await pool.query(
      "INSERT INTO migrations(version) VALUES(2) ON CONFLICT DO NOTHING",
    );
  }
  expect((await request("manager", "/health")).statusCode).toBe(200);
});

it("refuses production administrator bootstrap without changing existing users or policy", async () => {
  const before = await pool.query(
    "SELECT id,username,password,role,preferences FROM users ORDER BY id",
  );
  const policy = await pool.query("SELECT * FROM configuration");
  await expect(
    bootstrapAdmin("new-owner", "test-only-strong-admin-password"),
  ).rejects.toThrow("users already exist");
  expect(
    (
      await pool.query(
        "SELECT id,username,password,role,preferences FROM users ORDER BY id",
      )
    ).rows,
  ).toEqual(before.rows);
  expect((await pool.query("SELECT * FROM configuration")).rows).toEqual(
    policy.rows,
  );
});
