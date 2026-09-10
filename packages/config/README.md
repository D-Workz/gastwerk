# Shared policy and environment schema

## Purpose and boundaries

Owns the venue policy schema/default and API environment schema. It does not read or write PostgreSQL itself.

## Start here

- [policySchema, defaultPolicy and envSchema](src/index.ts)

## Interfaces and dependencies

Depends on contracts for preferences. API db.ts parses process.env; configuration repository/save functions parse persisted/submitted policy. Catalog uses the Policy type for calculations. Like the other shared source directories, it has no separate npm manifest or build.

## Behavior and invariants

Policy schema version is currently 1; persisted row revision is separate. Pricing defaults, correction reason length, category quick choices, initial display settings and branding are validated fields. Environment variables govern database connection, API port, browser origin and cookie behavior; do not copy credentials into module documentation.

## Making changes

Coordinate new fields with manager PolicyForm, configuration persistence and catalog calculation. Changing defaultPolicy alone does not rewrite existing persisted policy. Keep canonical environment instructions in the root README.

## Verification

[pricing policy consumers](../../tests/domain.test.ts); [policy snapshot and preference behavior](../../tests/api.integration.test.ts).

Run `npm test -- tests/domain.test.ts` from `codex/`. Requires the installed root npm dependencies and supported Node runtime; no database is needed. See [canonical setup](../../README.md) and [Milestone 3 execution results](../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

Use the [architecture map](../../docs/architecture.md) for neighboring modules and the [review findings](../../docs/milestone-3-review.md) for qualified claims.
