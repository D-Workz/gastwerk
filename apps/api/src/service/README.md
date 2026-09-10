# Orders, snapshots and repeat ordering

## Purpose and boundaries

Owns order creation/closure, unsent lines, editable snapshots, repeat/decrement/undo, previews and the aggregate state read. Fulfillment owns preparation transitions and invokes service helpers.

## Start here

- [addLine, editLine, lockedLine and closeOrder](service.ts)
- [repeatLine, decrementLine and undoRemoval](repeat.ts)
- [historical/current preview](preview.ts)
- [role-filtered state](readState.ts)
- [line projection and order totals](repository.ts)

## Interfaces and dependencies

Mutation services receive the same transaction client from the HTTP mutation envelope. They use catalog resolution, configuration and shared permission/audit helpers. `lockedLine` acquires the table advisory lock before the line row lock and checks the expected revision. `/orders/:id/send` orchestration and its membership SQL currently live in `app.ts`, not this directory.

## Behavior and invariants

An active table has at most one open order, backed by an index. New selections use current catalog/policy; ordinary edits use the historical product and snapshotted ingredient/pricing details, augmented with current ingredients absent from the snapshot. Draft/submitted edits preserve attribution, including splits. Repeat compares expected customization excluding count, re-resolves current recipe/price/station, and increments matching drafts below 100 or adds a new draft. It never increments sent work. Decrement applies only to drafts; zero cancels and audit-qualified revision-checked undo can restore it while the order is open. Closure rejects unfinished lines. `readState` uses a read-only repeatable-read transaction; station responses omit drafts and other-station lines and return no orders, but still include catalog and balances.

## Making changes

For count/repeat work inspect `repeat.ts`, waiter `Service.tsx`, notes flushing and the mutation queue. Preserve lock order and the enclosing transaction across service/fulfillment/inventory. Do not treat snapshot data as immutable under an authorized pre-preparation edit; catalog changes alone do not rewrite it.

## Verification

[order, repeat, undo, size and history scenarios](../../../../tests/api.integration.test.ts); [note flush and retry behavior](../../../../tests/notes.test.tsx).

Run `npm run test:integration` from `codex/`. Requires the isolated `venue_test` PostgreSQL database; the suite mutates test fixtures. It was inspected, not executed for Milestone 3. See [canonical setup](../../../../README.md) and [Milestone 3 execution results](../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

State reads load all historical lines/orders before filtering; no pagination is implemented. The frontend AppState response type is owned by web shared transport, not a shared runtime response schema. Use the [architecture map](../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../docs/milestone-3-review.md) for qualified claims.
