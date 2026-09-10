# Gastwerk — restaurant operations

A single-venue restaurant application with persistent ingredient inventory, recipes, configurable ordering, kitchen/bar queues and service history. German is the default language; English is available. Order values are informational: closing an order does not record a payment or issue a fiscal receipt.

The business baseline is [spec.md](../instructions/milestone1.md); the active waiter workflow milestone is [Milestone2.md](../instructions/Milestone2.md). See [milestone status](docs/milestone-status.md) for verification and limitations. No license has been selected.

## Start with Docker Compose (local development)

Prerequisites: Docker Engine with Docker Compose, available localhost port 5173 and PostgreSQL port 5432. No host Node installation is needed for Compose.

```sh
docker compose up -d --build
docker compose ps
```

Open **http://localhost:5173**. The API waits for PostgreSQL, runs versioned migrations and inserts missing demo records. Normal restarts preserve data. The database uses a named volume. Both published ports bind only to localhost.

| Username | Role                             | Default demo password |
| -------- | -------------------------------- | --------------------- |
| manager  | All workflows and administration | local-demo-change-me  |
| waiter   | Ordering and service             | local-demo-change-me  |
| kitchen  | Kitchen preparation              | local-demo-change-me  |
| bar      | Bar preparation                  | local-demo-change-me  |

These are demonstration accounts, unsuitable for an exposed deployment. `DEMO_PASSWORD` changes the initial seed password, not passwords of existing users. Managers can change existing passwords in Management → Users. Configure HTTPS and `COOKIE_SECURE=true` if operating behind an HTTPS proxy; set `APP_ORIGIN` to its exact browser origin.

Production is a separate root Compose stack: follow [deployment](../docs/deployment.md) and [operations](../docs/operations.md). It does not run the demo seed and uses explicit migration/admin setup. Do not expose this development stack as production.

Optional configuration: copy `.env.example` to `.env`, then edit values. Compose automatically reads `.env`. `POSTGRES_PASSWORD` overrides the local database password for both db and API; changing it does not change an existing PostgreSQL volume's password. The API's host-development default connection is shown in `.env.example`.

```sh
docker compose logs api
docker compose restart
docker compose stop
```

Explicit destructive reset, **only if you want to erase all venue data**:

```sh
docker compose down -v
docker compose up -d --build
```

## Develop locally

Supported baseline: Node.js 24 LTS, npm 11 or 12, PostgreSQL 18. Also verified on host Node 26.8.1/npm 12.0.2. The lockfile pins resolved dependencies. Docker uses Node 24.

```sh
npm ci
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev:api
```

In a second terminal:

```sh
npm run dev:web
```

Stop the Compose web/API services first if they occupy your development ports: `docker compose stop web api`. The development frontend proxies `/api` to port 3001. Host scripts read exported environment variables; they do not automatically load `.env`. Defaults work with the default Compose database. Override `DATABASE_URL`, `PORT`, `APP_ORIGIN` and `API_PROXY` when needed.

## Tests and checks

Create isolated test databases once. Integration tests refuse to run against a URL that does not contain `venue_test`. Browser setup resets **only** `venue_e2e` and never the normal `venue` database. Do not run test suites concurrently against the same test database.

```sh
docker compose exec db createdb -U venue venue_test
docker compose exec db createdb -U venue venue_e2e
npx playwright install chromium
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
```

“Database already exists” is harmless when repeating database creation. `TEST_DATABASE_URL` may override the integration database URL; keep the isolated database name. Browser tests use localhost ports 3002/5180 and the fixed local `venue_e2e` database. Playwright may need OS browser libraries; consult its installation output.

`npm run check` runs the full code, database and browser suite above. `npm run format` applies formatting. With the Compose application running, `npm run test:compose` verifies that orders, stock, configuration and the login session survive a container restart. It creates a marked test draft on table 2, cancels it afterwards, and closes that order only if no other unfinished lines exist. It intentionally leaves the verification history.

## Repository orientation

For code changes, read [AGENTS.md](AGENTS.md), then the [architecture module index](docs/architecture.md#module-index) and the README for the affected module. The application command root is this `codex/` directory; the outer Git repository also contains a separate portfolio.

Start with the [API application guide](apps/api/README.md) or [browser application guide](apps/web/README.md). The [Milestone 3 review](docs/milestone-3-review.md) records inspected source/test routes, documentation discrepancies and checks actually executed. Historical milestone records remain dated evidence rather than proof of the current tree.

## Project guide

- [Architecture and decisions](docs/architecture.md)
- [API contracts and retry rules](docs/api.md)
- [Configuration examples and editable policies](docs/configuration.md)
- [Manager, waiter and station guides](docs/users.md)
- [Extension guide](docs/extensions.md)
- [Milestone verification](docs/milestone-status.md)

## Troubleshooting

- **Nginx `host not found in upstream "api"`:** verify `docker compose ps` shows a healthy API. Rebuild/recreate the web container with `docker compose up -d --build --no-deps --force-recreate web` to restore its Compose network attachment. This preserves the database volume. Nginx uses Docker DNS with runtime upstream resolution (Nginx 1.27.3 or later), so temporary DNS failures do not terminate the web process and API address changes are picked up automatically. API requests may return 502 while resolution/connectivity recovers; check `/api/health` as well as the web healthcheck, which only checks static serving.
- **Database connection refused:** wait for `docker compose ps` to show db healthy; verify port 5432 and `DATABASE_URL`.
- **Login does not work:** check the configured initial demo password. Reseeding deliberately does not reset existing passwords or user preferences.
- **403 origin/protection error:** browser origin must exactly match `APP_ORIGIN`. Custom API clients must send `X-Requested-With: venue` on POST requests.
- **409 conflict:** refresh and review the latest item/configuration before making a new edit. Do not blindly resubmit stale revisions.
- **Connection failure after sending:** no success is implied. Use Retry; the same idempotency key retrieves the original result if the server already committed it. Retry metadata survives refresh in that tab.
- **Negative stock:** preparation is allowed by policy. A manager should append a correction with a reason after checking physical stock.
- **Port conflict:** stop the process using the documented port or consistently change Compose ports, origins and development proxy settings. The sibling portfolio uses port 5174; reserve 5173 for this application. After a failed Docker port bind, use `docker compose up -d --force-recreate web` once the port is free: simply starting the failed container may leave it without a network attachment.

## Milestone two waiter workflow

Tables → Menu → size/preparation tiles → Order. The last required choice saves an unsent item; Send order remains explicit. Order starts collapsed, notes edit inline, and One more repeats the exact configuration into unsent work. Current recipe/price changes require review. German and English flows use the same controls.

Startup applies migration 2 without resetting data. Existing products keep their recipes/prices and receive empty sizes; untouched legacy demo choice labels receive short translated tile names. The seed adds `apple-sizes-demo` with explicit demonstration quantities/prices. Configure actual serving sizes through the manager's Advanced record editor using [these examples](docs/configuration.md#serving-sizes-milestone-two). Historical snapshots and consumed stock remain unchanged.

See [frontend boundaries](docs/architecture.md#milestone-two-frontend-boundaries), [role workflows](docs/users.md), [API additions](docs/api.md#milestone-two-additions), and the [milestone two verification record](docs/milestone2-status.md).

## Deployment and configurable local ports

See the [Milestone 4 review](../docs/milestone-4-review.md) for demonstrated production-mode checks and unresolved server inputs. `RESTAURANT_DEV_PORT` changes the local Compose web/Vite port (default 5173); `POSTGRES_DEV_PORT` changes the loopback DB debugging port (5432). If changing ports, also set `APP_ORIGIN`, host `DATABASE_URL` and portfolio `VITE_DEMO_URL` to match. Export host-script variables explicitly, e.g. `RESTAURANT_DEV_PORT=15173 npm run dev:web`; Compose reads its `.env` automatically. `API_PROXY` controls Vite's local API target. The compiled production API is built with `npm run build:api`; production Docker starts only the compiled server.
