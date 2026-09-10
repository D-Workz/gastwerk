# Kitchen and bar presentation

## Purpose and boundaries

Owns station queue rendering and recent amendment/cancellation notices. App supplies polled state; fulfillment and inventory enforce transitions and consumption.

## Start here

- [public Station export](index.ts)
- [queue projection](Station.tsx)
- [ticket details and transition actions](../../shared/ui/LineCard.tsx)

## Interfaces and dependencies

Station receives AppState, kitchen/bar selection, translation functions and Mutate. It filters by snapshotted station, excluding drafts/served lines but retaining cancelled tickets. LineCard sends revision-bearing transition requests.

## Behavior and invariants

Start preparing and Mark ready use the current line revision. A stale action is rejected by the server. Recent relevant history is filtered against visible lines and limited to 30 entries; server state history is already limited to 200. Client filtering supports manager station views but is not a substitute for server role filtering.

## Making changes

Change ticket presentation in shared LineCard with waiter consumers in mind. Change station queue selection here. Preparation permission/timing changes require inspecting fulfillment, service locks, inventory and integration coverage.

## Verification

[multi-session English/German station workflows](../../../../../tests/e2e/workflow.spec.ts); [station permission and consumption invariants](../../../../../tests/api.integration.test.ts).

Run `npm run test:integration` from `codex/`. Requires the isolated `venue_test` PostgreSQL database; the suite mutates test fixtures. It was inspected, not executed for Milestone 3. See [canonical setup](../../../../../README.md) and [Milestone 3 execution results](../../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

No dedicated Station component test was found. Cancelled tickets are retained without a frontend age window; aggregate reads include historical data. Use the [architecture map](../../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../../docs/milestone-3-review.md) for qualified claims.
