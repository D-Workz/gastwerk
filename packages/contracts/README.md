# Shared contracts

## Purpose and boundaries

Owns Zod catalog/customization/preference schemas, transport-facing types, translated labels and choice/size default normalization. It contains no database access or authoritative price calculation.

## Start here

- [schemas, types, label and withChoiceDefaults](src/index.ts)

## Interfaces and dependencies

API parsers, browser components and config import this source file directly through relative paths. package.json declares workspace globs, but this directory has no individual package manifest/build/export map. Snapshot/Line/Order/User are TypeScript types; not every response has a runtime schema.

## Behavior and invariants

Quantities and money use decimal strings; customization count is an integer from 1 to 100. Serving size IDs differ from item count. withChoiceDefaults applies configured group defaults and normalizes a single size. Structural validation here is supplemented by reference, availability and state checks in backend services.

## Making changes

Inspect catalog resolver/save checks, existing stored JSON, config, API and UI callers when changing schemas. Preserve historical snapshot compatibility. Add behavioral tests at the actual consumer, not tests that only duplicate the schema definition.

## Verification

[choice and size resolution consumers](../../tests/domain.test.ts); [API validation and historical documents](../../tests/api.integration.test.ts).

Run `npm test -- tests/domain.test.ts` from `codex/`. Requires the installed root npm dependencies and supported Node runtime; no database is needed. See [canonical setup](../../README.md) and [Milestone 3 execution results](../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

Use the [architecture map](../../docs/architecture.md) for neighboring modules and the [review findings](../../docs/milestone-3-review.md) for qualified claims.
