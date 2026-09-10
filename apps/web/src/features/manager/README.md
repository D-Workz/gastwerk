# Manager administration

## Purpose and boundaries

Owns catalog/policy editing, inventory entry and user administration UI. Closed-order/history rendering remains in App, while validation/permissions and persistence remain in the API.

## Start here

- [public Manager export](index.ts)
- [tabs, editor state, reads and save actions](Manager.tsx)
- [common catalog field rendering](CatalogForm.tsx)
- [policy field rendering](PolicyForm.tsx)

## Interfaces and dependencies

Manager receives polled AppState and Mutate. It fetches users/movements via shared api when the selected tab or state changes. CatalogForm/PolicyForm parse editor JSON and emit updated JSON; Manager sends the document and captured revision. Inventory/users use their dedicated routes.

## Behavior and invariants

Existing catalog/policy records keep expected revisions; the API rejects stale saves. Advanced record JSON exposes groups, sizes and full effect maps. Client checks improve editing but do not replace backend Zod/reference validation. Inventory append-only behavior and role checks are enforced remotely. Changing a user invalidates that user’s sessions through identity service.

## Making changes

Use CatalogForm for ordinary fields and PolicyForm for policy fields; update schemas and relevant API services for contract changes. Keep serving-size mapping examples in configuration docs aligned with the advanced editor. Avoid adding authoritative pricing or role enforcement solely to the UI.

## Verification

[manager setup in browser workflow](../../../../../tests/e2e/workflow.spec.ts); [catalog, policy, stock and permission behavior](../../../../../tests/api.integration.test.ts).

Run `npm run test:integration` from `gastwerk/`. Requires the isolated `venue_test` PostgreSQL database; the suite mutates test fixtures. It was inspected, not executed for Milestone 3. See [canonical setup](../../../../../README.md) and [Milestone 3 execution results](../../../../../docs/milestone-3-review.md) for prerequisites and the distinction between inspected tests and executed checks.

## Limitations and related documentation

No dedicated Manager/CatalogForm/PolicyForm component tests were found. Existing browser coverage is representative setup, not exhaustive administration coverage. State polling can trigger additional user/ledger fetches while those tabs are active. Use the [architecture map](../../../../../docs/architecture.md) for neighboring modules and the [review findings](../../../../../docs/milestone-3-review.md) for qualified claims.
