# PostgreSQL lifecycle

## Purpose and boundaries

Owns connection/environment initialization, transaction lifecycle, schema migrations and insert-if-missing demonstration seed data. Domain SQL also lives in owning services/repositories.

## Start here

- [env, pool, Tx and transaction](db.ts)
- [migrate](migrate.ts)
- [seed](seed.ts)
- [startup sequence](../../Dockerfile)

## Interfaces and dependencies

`Tx` is a pg PoolClient; `transaction` begins, commits or rolls back and always releases it. `db.ts` parses the environment at import. The API Docker command migrates, seeds, then starts the HTTP entry point. Host development commands do not automatically run migrations or load a dotenv file.

## Behavior and invariants

Migrations run under an advisory transaction lock. Initial DDL is executed idempotently on each invocation; migration 2 separately checks its version before normalizing missing sizes and untouched legacy labels. Snapshot/order/ledger data is not rebuilt. Seed uses stable IDs and conflict-ignore inserts, preserving existing catalog/users; it can reinsert missing demonstration rows, including fixed opening movement IDs. It is demonstration provisioning, not a production backup/restore mechanism.

## Making changes

Append a numbered migration for future persistence changes and inspect historical JSON parsing against evolving schemas. Preserve open-order and consumption uniqueness constraints and lock order. Use isolated test databases; never run test reset helpers against normal venue data.

## Verification

[repeat migration/seed and migration-two preservation](../../../../tests/api.integration.test.ts); [destructive isolated browser fixture setup](../../../../tests/e2e/setup.ts).

Run `npm run test:integration` from `codex/`. Requires the isolated `venue_test` PostgreSQL database; the suite mutates test fixtures. It was inspected, not executed for Milestone 3. See [canonical setup](../../../../README.md) and [Milestone 3 execution results](../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

Integration isolation currently checks whether the connection string contains `venue_test`; it is not a robust parsed database-name check. Browser setup explicitly drops/recreates the schema in its fixed test database. Neither was run for this documentation task. Use the [architecture map](../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../docs/milestone-3-review.md) for qualified claims.

## Production lifecycle

The root production stack preserves PostgreSQL 18 in a stable named volume and runs migrations explicitly through the [deployment wrapper](../deployment/README.md). API startup never seeds production. Local demo seeding remains available in the development workflow. Production secret-file validation occurs before pool construction; [operations](../../../../../docs/operations.md) documents isolated logical backup/restore verification. Do not use the development seed to initialize or reset an existing production database.
