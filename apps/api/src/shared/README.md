# Mutation envelope, permissions and audit

## Purpose and boundaries

Provides the common mutation transaction/retry envelope plus permission and audit functions. This is backend infrastructure with direct Fastify and identity dependencies, not a pure domain library.

## Start here

- [mutation](mutation.ts)
- [permit and audit](audit.ts)

## Interfaces and dependencies

`mutation(request, work)` authenticates, validates a UUID key and invokes `work(tx, user)`. Services call `permit` and append audit events using the same transaction client. Domain errors are imported from catalog.

## Behavior and invariants

The retry fingerprint hashes method, URL and JSON-stringified body. A per-user/key advisory lock serializes repeats; the durable request row and response commit with business effects. The same key/fingerprint returns the recorded response; different input returns 409. Failed work rolls back. Property-order changes can change the fingerprint: retain the original body for retry. Authentication happens before replay; service permission checks run when work executes, not again on a stored-response replay. Manager is always permitted; other roles must be in the explicit list.

## Making changes

Keep identity, frontend retry storage and all affected service invariants in view. The envelope supplies atomicity/idempotency, but does not grant permission or validate every business payload itself.

## Verification

[duplicate operations, changed keys and rollback](../../../../tests/api.integration.test.ts); [client queue and same-key retry](../../../../tests/notes.test.tsx).

Run `npm run test:integration` from `gastwerk/`. Requires the isolated `venue_test` PostgreSQL database; the suite mutates test fixtures. It was inspected, not executed for Milestone 3. See [canonical setup](../../../../README.md) and [Milestone 3 execution results](../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

Request rows have no expiry/cleanup here. Audit events are append-only through the helper, but no cryptographic tamper-evidence system is implemented. Use the [architecture map](../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../docs/milestone-3-review.md) for qualified claims.
