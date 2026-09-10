# Preparation and replacement

## Purpose and boundaries

Coordinates line transitions and the moment ingredients are consumed. It shares one PostgreSQL transaction with order and inventory work.

## Start here

- [transition and replace](service.ts)
- [lockedLine and addLine](../service/service.ts)
- [consume](../inventory/service.ts)

## Interfaces and dependencies

HTTP handlers call `transition(tx, user, id, version, target, reason)` inside `mutation`. Fulfillment imports service locking/creation, inventory consumption, configuration and permission/audit helpers. SQL updates to lines occur here directly; there is no standalone fulfillment repository.

## Behavior and invariants

The normal sequence is draft → submitted → preparing → ready → served. Starting/finishing preparation requires the snapshotted station role (or manager); waiter/manager handles submission and serving. Starting preparation writes negative snapshot quantities multiplied by count before updating state, all in one transaction. Cancellations retain consumption; served corrections require manager permission and a policy-length reason. Replacement cancels a preparing/ready line and creates a new submitted line with a link to its original. It does not reclaim ingredients.

## Making changes

Inspect service row locking and inventory constraints when changing a transition. Keep rollback tests that inject a failed consumption insert, plus stale-revision, station-permission and replacement coverage. Rendering station buttons is not an authorization boundary.

## Verification

[consumption rollback, retries and replacements](../../../../tests/api.integration.test.ts); [multi-session station workflow](../../../../tests/e2e/workflow.spec.ts).

Run `npm run test:integration` from `gastwerk/`. Requires the isolated `venue_test` PostgreSQL database; the suite mutates test fixtures. It was inspected, not executed for Milestone 3. See [canonical setup](../../../../README.md) and [Milestone 3 execution results](../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

Use the [architecture map](../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../docs/milestone-3-review.md) for qualified claims.
