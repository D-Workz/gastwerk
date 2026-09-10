# Contracts: the shared language of the app

Contracts defines the data that Gastwerk's browser and API agree to use. Here, “contract” means an agreement about the shape of data: for example, which fields describe a product or an order item.

Keeping these definitions together helps the manager form, waiter screens and API use consistent names and value formats.

## What is inside?

The entry point is [src/index.ts](src/index.ts).

- **Schemas** describe and validate ingredients, products, tables, customization input and user preferences. They use Zod, a runtime data-validation library.
- **TypeScript types** describe data for developers and the compiler, including users, order items, orders and snapshots of calculated items.
- **Small shared helpers** select translated labels and apply configured choice or serving-size defaults.

A TypeScript type helps check code during development; it does not validate incoming JSON at runtime. Zod schemas provide runtime checks when a caller invokes them. Some structures, including `Line`, `Order`, `User` and `Snapshot`, currently have types without a matching runtime response schema.

## How the applications use it

For example, `customizationSchema` describes a selected product, item count, choices, ingredient edits and a note. The browser uses the corresponding `Customization` type, and the API validates submitted customization input. Both use the same definitions, but the API must also check that referenced products and ingredients exist and that the requested operation is allowed.

The [catalog resolver](../../apps/api/src/catalog/resolve.ts) performs recipe and price calculations. Contracts does not calculate authoritative prices, grant permissions or access the database.

The `withChoiceDefaults` helper combines configured group defaults with explicit choices and selects the sole serving size if none was supplied. It does not prove that IDs are valid or calculate ingredient quantities. The `label` helper selects German or English text, falling back to the other translation when needed.

## Important boundaries

Money and ingredient quantities are represented as decimal strings. The number of items in a customization is an integer from 1 to 100; it is different from a serving-size ID or an ingredient quantity.

Changes here can affect both applications, [config](../config/README.md) and previously stored JSON. Inspect callers and historical snapshot compatibility before changing a field or validation rule. Structural checks are supplemented by availability, reference and workflow checks in API services.

## Verification

[Domain tests](../../tests/domain.test.ts) exercise choices, serving sizes and invalid customization through the resolver. [API integration tests](../../tests/api.integration.test.ts) exercise validation and historical documents through server operations.

With dependencies installed and the [supported Node runtime](../../README.md#tests-and-checks), run `npm test -- tests/domain.test.ts` from `gastwerk/`; no database is needed. Integration tests require the isolated database described in that guide. Test references are not evidence of a new test run.

Return to the [packages overview](../README.md) or [architecture map](../../docs/architecture.md).
