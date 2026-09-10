# Extension guide

## Add a product option without code

Edit a product's ordered `groups` in its advanced record. Give every group/choice a stable ID, German/English labels, required/default settings, explicit effects and price adjustment. Enable `guided` if required choices have no defaults. Test the product in the waiter preview, then prepare a test item and verify its ledger quantities. See [configuration](configuration.md).

## Add an ingredient effect or pricing policy

Extend the Zod contract in `packages/contracts` or `packages/config`, then implement the pure resolver in `apps/api/src/catalog/resolve.ts`. Keep Decimal.js calculations on the server. Add tests for valid and invalid effects, effect ordering, explicit edits, old policy snapshots and price rounding. Update the configuration schema migration, manager editor and docs. Do not interpret notes or branch on product names.

## Add a UI view

Start at the [web application guide](../apps/web/README.md) and [module index](architecture.md#module-index). Place new feature rendering/orchestration under `apps/web/src/features/`, expose a feature entry point and compose it in App. Reuse [web shared transport and controls](../apps/web/src/shared/README.md), [contracts](../packages/contracts/README.md) and [generic UI primitives](../packages/ui/README.md) where appropriate. Keep waiter-specific customization within its owning feature. Submit mutations through `useMutation` so retry keys and lost-response behavior remain consistent. Add a translated display preference only if needed; do not let preferences override domain permissions or pricing.

## Add an application service

Place it in the owning backend module. Validate untrusted input, enforce role permissions in the service, and accept an explicit transaction client for mutations. Reuse services from other modules rather than writing their tables directly. Keep the HTTP handler thin. Cross-module work must use one transaction when invariants span modules; retain row/version checks and request deduplication. Record acting users and append relevant audit/ledger events.

For persistence changes, append a numbered migration under the migration lock, preserve existing data, and test PostgreSQL upgrades and repeat startup. Do not alter the specification to match an implementation shortcut. Add a documented decision or milestone gap instead.

## Tests to extend

- `tests/domain.test.ts`: exact conversion, effects, pricing, invalid quantities.
- `tests/components.test.tsx`: observable ordering/customization controls.
- `tests/api.integration.test.ts`: PostgreSQL transactions, permissions, policy/history and concurrency.
- `tests/e2e/workflow.spec.ts`: real sessions, preparation, preferences, reconnection and lost-response retries.
- `tests/compose-smoke.ts`: production service restart persistence.

Keep fixtures isolated from normal venue data. Tests should assert externally visible results and ledger invariants rather than internal implementation structure.
