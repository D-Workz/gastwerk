# Venue policy and user preferences

## Purpose and boundaries

Owns persisted venue policy and per-user display preference changes. Schema/default definitions belong to the shared config/contracts packages.

## Start here

- [configuration reader](repository.ts)
- [revision-checked policy save](saveConfiguration.ts)
- [current-user preference save](savePreferences.ts)
- [policy schema and defaults](../../../../packages/config/src/index.ts)

## Interfaces and dependencies

Policy is parsed from singleton configuration row 1; a missing row produces a setup error. Manager saves accept `{data, version}` inside the mutation transaction and append audit history. Preferences use the authenticated user ID and the shared preferences schema.

## Behavior and invariants

Policy schema version 1 differs from the database row revision: saves increment the latter. Existing line pricing follows its snapshot rather than newly saved venue pricing. Preference saves update only the current user and do not require a row revision; they are whole-document updates. Changing default display preferences does not rewrite existing users.

## Making changes

Update shared schemas and manager PolicyForm together for new policy fields. Distinguish executable invariant changes from editable policy values. Consider catalog resolution and historical editing before changing price policy.

## Verification

[policy snapshot and independent preference tests](../../../../tests/api.integration.test.ts); [configured rounding and pricing](../../../../tests/domain.test.ts).

Run `npm run test:integration` from `codex/`. Requires the isolated `venue_test` PostgreSQL database; the suite mutates test fixtures. It was inspected, not executed for Milestone 3. See [canonical setup](../../../../README.md) and [Milestone 3 execution results](../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

Use the [architecture map](../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../docs/milestone-3-review.md) for qualified claims.
