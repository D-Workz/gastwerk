# Ingredient ledger

## Purpose and boundaries

Owns ingredient movement writes and balance aggregation. It does not decide preparation timing; fulfillment calls consumption.

## Start here

- [consume and balances](service.ts)
- [manager movement validation](recordMovement.ts)
- [movement constraints and one_consumption index](../persistence/migrate.ts)

## Interfaces and dependencies

`consume(tx, lineId, snapshot, quantity, actor)` inserts one negative movement per resolved ingredient. `balances(tx)` sums PostgreSQL numeric values and returns decimal strings. Manager entries pass through `recordMovement`, catalog ingredient lookup, `convert` and `permit`. The full ledger GET query currently lives in API `app.ts`.

## Behavior and invariants

Consumption uses resolved per-serving quantities times item count. The shared mutation envelope deduplicates retry keys; line locks/revisions prevent a second start with another key; the unique `(line_id, ingredient_id)` consumption index is the final guard. All writes share the caller transaction. Only corrections can have a negative manual amount; compatible conversions and explicit pack content are required. Reasons and actors are recorded. Negative balances are allowed; availability is not automatically changed.

## Making changes

Keep conversion precision, ingredient base units and database numeric limits aligned. Test failed partial consumption and retained stock on cancellation. Do not replace ledger history with a cached mutable balance.

## Verification

[simultaneous retries, rollback and conversion rejection](../../../../tests/api.integration.test.ts); [unit conversion](../../../../tests/domain.test.ts).

Run `npm run test:integration` from `codex/`. Requires the isolated `venue_test` PostgreSQL database; the suite mutates test fixtures. It was inspected, not executed for Milestone 3. See [canonical setup](../../../../README.md) and [Milestone 3 execution results](../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

Use the [architecture map](../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../docs/milestone-3-review.md) for qualified claims.
