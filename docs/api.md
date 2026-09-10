# API

Base path: `/api`. JSON throughout. The executable schemas are in `packages/contracts/src/index.ts`, `packages/config/src/index.ts` and each administration service. Decimal quantities and monetary values are JSON **strings**, never floating-point amounts. Timestamps serialize as UTC ISO timestamps.

All POST requests, including login, require `Content-Type: application/json` and `X-Requested-With: venue`. Authenticated mutations additionally require `Idempotency-Key: <UUID>`. Cookies authenticate requests. Preview is read-only and needs no idempotency key.

| Route                        | Access               | Input / result                                                                                              |
| ---------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET `/health`                | Public               | `{ok:true}` after DB, migration 2 and configuration checks; 503 when not ready                              |
| POST `/login`                | Public, rate limited | `{username,password}` → public user; sets session cookie                                                    |
| POST `/logout`               | Session optional     | `{}` → `{ok:true}`, removes session/cookie                                                                  |
| GET `/me`                    | Authenticated        | `{id,username,role,preferences}`                                                                            |
| GET `/state`                 | Authenticated        | User, catalog, configuration, permitted lines/orders, balances, latest 200 history events                   |
| POST `/preview`              | Manager/waiter       | `{input:Customization,lineId?:string}` → resolved Snapshot; lineId previews using historical recipe/pricing |
| POST `/preferences`          | Authenticated        | Complete display preferences → persisted preferences                                                        |
| POST `/catalog/:kind`        | Manager              | kind = ingredient/product/table; `{data,version}` → `{id}`; version 0 creates                               |
| POST `/configuration`        | Manager              | `{data:Policy,version}` → `{ok:true}`                                                                       |
| GET `/users`                 | Manager              | Public user administration records; no password hashes                                                      |
| POST `/users`                | Manager              | `{id?,username,password?,role,active}` → `{ok:true}`; new users require password (12–200 characters)        |
| GET `/inventory`             | Manager              | Complete attributable movement ledger                                                                       |
| POST `/inventory`            | Manager              | `{ingredientId,quantity,unit,packQuantity?,kind,reason}` → `{ok:true}`                                      |
| POST `/lines`                | Manager/waiter       | `{tableId,input:Customization}` → `{id}`; draft created in table's open order                               |
| POST `/lines/:id/edit`       | Manager/waiter       | `{version,input,split?:boolean}` → `{id}`; only draft/submitted                                             |
| POST `/lines/:id/transition` | Role-specific        | `{version,state,reason?}` → `{id}`                                                                          |
| POST `/lines/:id/replace`    | Manager/waiter       | `{version,input,reason}` → new `{id}`; atomically cancels preparing/ready original and submits replacement  |
| POST `/orders/:id/send`      | Manager/waiter       | `{lines:[{id,version},...]}` → `{ok:true}`; explicit drafts, all-or-nothing                                 |
| POST `/orders/:id/close`     | Manager/waiter       | `{}` → `{id}`; requires all lines served/cancelled                                                          |

Station users receive no drafts, other-station lines or order totals. They can start/complete only their assigned station. Managers may act at either station. Draft submission, serving and cancellation require waiter/manager permission; served correction requires manager permission.

## Customization example

```json
{
  "productId": "burger",
  "quantity": 1,
  "choices": {},
  "edits": [
    { "ingredientId": "onion", "quantity": "0" },
    { "ingredientId": "cheese", "quantity": "20", "portionId": "slice" }
  ],
  "note": "Cut in half"
}
```

Edits are explicit **final quantities per sale unit**, applied after guided choice effects. Duplicate ingredient edits, unavailable ingredients, unknown choice/portion identifiers, invalid quantities and negative effects are rejected. Line quantity is a positive integer up to 100. Ingredient quantities support up to three decimal places; whole-piece ingredients reject fractions.

Snapshot responses include the product, historical ingredient details, effective quantities, server-calculated unit price, allergen completeness, optional reference ingredient cost, pricing policy and policy revision. The browser never sends a trusted price or stock deduction.

## Stock example

```json
{
  "ingredientId": "juice",
  "quantity": "1",
  "unit": "pack",
  "packQuantity": "6000",
  "kind": "delivery",
  "reason": "One case: six 1000 ml bottles"
}
```

Allowed units: g, ml, piece, kg, l, pack. `packQuantity` is explicit contents in the ingredient base unit. Only corrections can be negative. A reason is always required.

## Errors, retries and conflicts

Errors use `{code,message,fields?}`. Validation fields contain Zod's form and field errors. Status 400 means invalid input/state policy, 401 unauthenticated, 403 unauthorized, 409 revision/idempotency conflict, 429 rate limit, and 500 failed operation. No transaction partially commits on error.

Use one UUID per intended mutation and retain its exact URL/body for retries. A repeated successful request returns the original result without new effects. A different body using that key returns 409. Failed transactions do not reserve a completed key; they can be retried. A lost HTTP response does not tell the client whether commit happened, so retry the same key. After a revision conflict, fetch current state, review it, and create a new operation with the new version and a new UUID.

## Milestone two additions

- `Customization.sizeId?: string`: stable serving-size ID. Required when multiple sizes exist; the sole size is normalized automatically. Legacy products with `sizes: []` retain base behavior.
- Product `sizes[]`: `{id,name,volume?,recipe,price,effects}`; see [configuration](configuration.md). Duplicate sizes and unknown effect mappings/ingredients are rejected.
- POST `/lines/:id/repeat`: `{input: Customization}` → `{id}`. Source quantity is ignored for identity; each action adds exactly one. Expected size/options/edits/note must still match the source. Current catalog availability, resolved recipe and price are validated. A matching draft increments atomically (up to 100 per line); sent lines are never incremented. If all matching lines reach 100, a new unsent line is created. Closed/cancelled sources reject. Changed prices/recipes return 409 `repeat_review` and require explicit review through ordinary preview/add.
- POST `/lines/:id/decrement`: `{version}` → `{id}`. Only unsent quantities decrease. Zero retains a cancelled audit record; stock is untouched.
- POST `/lines/:id/undo-removal`: `{version}` → `{id}`. Restores only the latest zero-decrement removal in an open order, preserving the original snapshot and quantity one. It cannot undo arbitrary cancellation or preparation.

All three endpoints require waiter/manager permission, CSRF protection and an idempotency key. A distinct repeat tap gets a distinct key; retries retain the same key and exact body. Notes continue through `/edit` and its existing revision/amendment policy. The frontend localizes error codes instead of displaying English backend messages or raw Zod fields.

Production keeps the same `/api` routes through the restaurant gateway. It requires secure host-only SameSite=Strict cookies, exact HTTPS APP_ORIGIN and scoped proxy trust; CSRF header/origin and role checks remain in force. See [production initialization](../apps/api/src/deployment/README.md) and [routing/iframe settings](../../docs/deployment.md).
