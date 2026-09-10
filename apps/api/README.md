# API application

Fastify composition and PostgreSQL-backed business services. Start with [src/main.ts](src/main.ts), which listens and closes the pool on signals, then [src/app.ts](src/app.ts), which registers protection hooks, authentication endpoints, error mapping and routes.

The [architecture module index](../../docs/architecture.md#module-index) links the backend modules. Mutations normally enter [shared/mutation.ts](src/shared/mutation.ts), then the owning service with a common transaction client. Price/recipe calculation is in [catalog](src/catalog/README.md), orders in [service](src/service/README.md), and preparation/consumption in [fulfillment](src/fulfillment/README.md) and [inventory](src/inventory/README.md). Request schemas are partly shared and partly defined by handlers/services. Some route handlers contain SQL and send orchestration; they are not uniformly thin adapters.

## How to navigate the server

API means Application Programming Interface: the HTTP endpoints the browser calls. This app is one server process with several business modules. A module is an area of responsibility inside that process, not another independently running service.

| Location under `src/` | Purpose | Start here |
| --- | --- | --- |
| `main.ts` | Listen for HTTP requests and shut down the server/database pool. | [Process entry point](src/main.ts) |
| `app.ts` | Register routes, request protections and error responses. | [Server composition](src/app.ts) |
| `identity/` | Login, sessions and user administration. | [Identity guide](src/identity/README.md) |
| `catalog/` | Catalog validation, recipe resolution and authoritative price calculation. | [Catalog guide](src/catalog/README.md) |
| `configuration/` | Save restaurant policy and user preferences. | [Configuration guide](src/configuration/README.md) |
| `service/` | Orders, items, previews, repeats and aggregate screen data. | [Restaurant service guide](src/service/README.md) |
| `fulfillment/` | Preparation transitions and replacement items. | [Fulfillment guide](src/fulfillment/README.md) |
| `inventory/` | Ingredient movements and stock balances. | [Inventory guide](src/inventory/README.md) |
| `persistence/` | Database pool, transactions, migrations and development seeding. | [Persistence guide](src/persistence/README.md) |
| `shared/` | Common mutation/retry support, permission checks and audit helpers. | [Shared API guide](src/shared/README.md) |
| `deployment/` | Production environment/secret handling and initial administration. | [Deployment guide](src/deployment/README.md) |

Here, `service/` means restaurant service: managing a guest's order. It does not mean all server logic lives in that folder. `persistence/` supplies database machinery; business modules also contain SQL for their own operations.

## Follow one request

When a kitchen worker starts preparing an item:

1. The browser sends an HTTP request containing the item's revision and a retry key.
2. The route uses the shared mutation wrapper, which authenticates the caller and manages a database transaction and stored-response replay for retries.
3. Fulfillment checks the permitted transition and current revision using the supplied transaction client.
4. Inventory records ingredient consumption, and fulfillment updates the line and audit history within that transaction.
5. The API returns a result; the browser refreshes the state it displays.

A transaction groups related database writes so they commit or roll back together. The retry key lets the mutation wrapper return an already-recorded result for the same request instead of repeating its business effects. The owning business operation still performs its permission and validity checks when it executes. See the [mutation contract](src/shared/README.md) for replay details and [integration tests](../../tests/api.integration.test.ts) for duplicate-request and rollback scenarios.

[Contracts](../../packages/contracts/README.md) defines shared input shapes; [config](../../packages/config/README.md) defines settings. API modules enforce business rules and persistence. The API does not import the React controls in packages/ui.

## Structural limitations across API modules

- `app.ts` mixes HTTP composition with some SQL and order-send coordination. A future separation should move business work into its owning module while preserving request checks and transaction boundaries; routes are not uniformly thin adapters today.
- `DomainError` is defined in catalog resolution but imported by identity, configuration and other modules. This creates a shared error dependency on one business module. Moving that common contract would be a coordinated refactor, not comment cleanup.
- SQL appears in repositories, business services and some routes. Folder names express ownership conventions, not mechanically isolated database access. Changes spanning orders, preparation and stock must inspect the cooperating modules and transaction/locking conventions.
- The browser-defined aggregate response type is also used by API tests. This cross-app issue is documented in the [main README](../../README.md#shared-response-contract-ownership).

These observations describe implemented structure. No refactoring or application architecture evaluation was performed for this documentation update.

## Running and verifying

Run all npm commands from `gastwerk/`, using the root package manifest and installed dependencies. `npm run dev:api` starts the server, but requires a configured/migrated/seeded PostgreSQL database first. Follow the [canonical local setup](../../README.md#develop-locally); do not use normal startup commands as documentation verification because they can mutate real data. [Dockerfile](Dockerfile) runs migration and seed before starting the server; [Compose](../../compose.yaml) waits for database health.

`npm run typecheck` is database-free. `npm run test:integration` uses an isolated test database and changes fixtures. Its setup, reset behavior and this milestone's execution status are in the [review](../../docs/milestone-3-review.md#verification). The route contract is in [API documentation](../../docs/api.md), and policy authoring in [configuration](../../docs/configuration.md).

## Production startup

Production uses the [deployment module](src/deployment/README.md) and [dedicated Dockerfile](Dockerfile.production). Migrations and initial administration are explicit one-shot commands. Readiness now requires migration 2 and a configuration row, returning 503 otherwise. See the root [deployment guide](../../../docs/deployment.md) for HTTPS origin, file-backed secrets and narrowly trusted forwarding configuration.
