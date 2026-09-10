# API application

Fastify composition and PostgreSQL-backed business services. Start with [src/main.ts](src/main.ts), which listens and closes the pool on signals, then [src/app.ts](src/app.ts), which registers protection hooks, authentication endpoints, error mapping and routes.

The [architecture module index](../../docs/architecture.md#module-index) links the eight backend modules. Mutations normally enter [shared/mutation.ts](src/shared/mutation.ts), then the owning service with a common transaction client. Price/recipe calculation is in [catalog](src/catalog/README.md), orders in [service](src/service/README.md), and preparation/consumption in [fulfillment](src/fulfillment/README.md) and [inventory](src/inventory/README.md). Request schemas are partly shared and partly defined by handlers/services. Some route handlers contain SQL and send orchestration; they are not uniformly thin adapters.

## Running and verifying

Run all npm commands from `codex/`, using the root package manifest and installed dependencies. `npm run dev:api` starts the server, but requires a configured/migrated/seeded PostgreSQL database first. Follow the [canonical local setup](../../README.md#develop-locally); do not use normal startup commands as documentation verification because they can mutate real data. [Dockerfile](Dockerfile) runs migration and seed before starting the server; [Compose](../../compose.yaml) waits for database health.

`npm run typecheck` is database-free. `npm run test:integration` uses an isolated test database and changes fixtures. Its setup, reset behavior and this milestone's execution status are in the [review](../../docs/milestone-3-review.md#verification). The route contract is in [API documentation](../../docs/api.md), and policy authoring in [configuration](../../docs/configuration.md).

## Production startup

Production uses the [deployment module](src/deployment/README.md) and [dedicated Dockerfile](Dockerfile.production). Migrations and initial administration are explicit one-shot commands. Readiness now requires migration 2 and a configuration row, returning 503 otherwise. See the root [deployment guide](../../../docs/deployment.md) for HTTPS origin, file-backed secrets and narrowly trusted forwarding configuration.
