# Config: settings and defaults

Config describes the settings Gastwerk understands and the default values used when creating an initial policy. It is the shared definition of configuration, not the place that saves settings or performs price calculations.

## What is inside?

The entry point is [src/index.ts](src/index.ts).

| Export | Purpose | Example |
| --- | --- | --- |
| `policySchema` and `Policy` | Runtime validation and TypeScript description of restaurant policy. | Rounding rules, pricing options, categories, branding and initial display preferences. |
| `defaultPolicy` | An initial policy produced from those defaults. | Used by development seeding and explicit administrator bootstrap. |
| `envSchema` | Basic server environment validation with development defaults. | API port, database connection setting, browser origin and cookie setting. |

A schema checks whether data has the expected structure and allowed values. Config uses Zod for these checks and imports preference definitions from [contracts](../contracts/README.md).

## How the applications use it

The browser's [PolicyForm](../../apps/web/src/features/manager/PolicyForm.tsx) uses the policy schema while editing settings. The API's [configuration module](../../apps/api/src/configuration/README.md) validates and stores policy. The [catalog resolver](../../apps/api/src/catalog/resolve.ts) uses the policy to calculate prices; the calculation itself stays on the server.

For example, config describes whether ingredient removals receive a proportional refund. The manager can select that option, the API saves it, and the resolver applies it when calculating an eligible customization.

The API's [runtime environment module](../../apps/api/src/deployment/environment.ts) reads supplied environment values and production secret files, applies production-specific checks, and uses `envSchema`. Config itself does not read files or connect to PostgreSQL. Server environment values are not frontend configuration to expose to visitors.

## Important boundaries

Changing `defaultPolicy` does not automatically update a policy already saved in the database. Policy schema version (currently 1) is also separate from the saved row's revision, which tracks edits. Historical order snapshots retain their captured pricing policy.

When adding a setting, inspect the editor, API validation/persistence and the calculation that consumes it. Keep environment setup instructions in the [main README](../../README.md) and production instructions in the [deployment guide](../../../docs/deployment.md).

## Verification

[Domain tests](../../tests/domain.test.ts) exercise pricing policies and rounding through their actual calculation consumers. [API integration tests](../../tests/api.integration.test.ts) cover persisted policy and snapshot behavior.

With dependencies installed and the [supported Node runtime](../../README.md#tests-and-checks), run `npm test -- tests/domain.test.ts` from `gastwerk/`; this command needs no database. Integration tests have separate isolated-database prerequisites in that guide. These references describe coverage, not a claim that tests were run for the current edit.

Return to the [packages overview](../README.md) or [architecture map](../../docs/architecture.md).
