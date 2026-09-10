/**
 * Manual persistence smoke check against the running local Compose application.
 * It creates a marked draft on table 2, restarts Compose, and compares state
 * before cancelling that draft. Execution changes application data and leaves history.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import type { AppState } from "../apps/web/src/shared/api/api";

const base = "http://localhost:5173/api";
let cookie = "";

async function request<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      "x-requested-with": "venue",
      "idempotency-key": crypto.randomUUID(),
      cookie,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(r.status, 200, await r.clone().text());
  if (path === "/login")
    cookie = r.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join(";");
  return r.json() as Promise<T>;
}

await request("/login", {
  username: "manager",
  password: process.env.DEMO_PASSWORD ?? "local-demo-change-me",
});
const added = await request<{ id: string }>("/lines", {
  tableId: "t2",
  input: {
    productId: "burger",
    quantity: 1,
    note: "Compose persistence verification",
  },
});
const before = await request<AppState>("/state");
execFileSync("docker", ["compose", "restart"], { stdio: "inherit" });
let ready = false;
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const r = await fetch(base + "/health");
    if (r.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert.equal(ready, true, "Compose did not recover");
const after = await request<AppState>("/state");
assert.deepEqual(after.balances, before.balances);
assert.deepEqual(after.configuration, before.configuration);
assert.deepEqual(after.lines, before.lines);

const line = after.lines.find((l) => l.id === added.id)!;
await request(`/lines/${line.id}/transition`, {
  version: line.version,
  state: "cancelled",
  reason: "Completed Compose persistence verification",
});
// Close only if the pre-cleanup snapshot shows no other unfinished items.
const orderLines = after.lines.filter(
  (l) => l.orderId === line.orderId && l.id !== line.id,
);
if (orderLines.every((l) => ["served", "cancelled"].includes(l.state)))
  await request(`/orders/${line.orderId}/close`, {});
console.log(
  "Compose restart preserved orders, stock, configuration and session. Verification line cancelled.",
);
