# Catalog and recipe resolution

## Purpose and boundaries

Owns catalog document reads/writes and pure recipe, conversion and price calculation. It does not create orders or consume stock.

## Start here

- [resolve, convert and DomainError](resolve.ts)
- [saveCatalog](saveCatalog.ts)
- [catalog read projection](repository.ts)
- [catalog and customization schemas](../../../../packages/contracts/src/index.ts)

## Interfaces and dependencies

Order creation, repeat and preview call `resolve(product, ingredients, input, policy, policyVersion)`. It returns a per-serving snapshot using Decimal.js. `saveCatalog` accepts a transaction client, authenticated user, payload and route parameters; shared `permit` restricts writes to managers. Repositories parse JSON through shared schemas.

## Behavior and invariants

Size recipe/price replaces the base when selected; ordered group effects run next, then explicit final-quantity edits. Missing size-specific effects fall back to base effects. Zero ingredient quantities are omitted from consumption quantities. Invalid/negative quantities, unknown choices, duplicate edits and fractional whole pieces are rejected. Prices have a zero floor and configured rounding. Item count is applied later by totals and inventory. Catalog writes enforce revision checks, immutable ingredient base units and active ingredient references; table archival shares the order table lock.

## Making changes

Change calculation rules in `resolve.ts`; change document shapes in contracts and reference checks in `saveCatalog.ts`. Review service historical snapshots, configuration policy and manager editors together. Persisted shape changes need a separately authorized migration, not a rewrite of old snapshots.

## Verification

[conversion, effects, pricing and size tests](../../../../tests/domain.test.ts); [catalog history and concurrency tests](../../../../tests/api.integration.test.ts).

Run `npm test -- tests/domain.test.ts` from `gastwerk/`. Requires the installed root npm dependencies and supported Node runtime; no database is needed. See [canonical setup](../../../../README.md) and [Milestone 3 execution results](../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

`DomainError` lives here but is imported across the backend; this is existing coupling, not a generic shared-error package. Use the [architecture map](../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../docs/milestone-3-review.md) for qualified claims.
