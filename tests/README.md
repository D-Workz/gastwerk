# Test overview

This folder checks business calculations, React interactions, API/database behavior and complete browser workflows. Different test types cover different parts of the application: a calculation test can explain a wrong price precisely, while a browser test checks that a user can actually place an order.

All commands below run from `gastwerk/`, not from `tests/`. Install dependencies with `npm ci` first. Follow the main README's [Tests and checks](../README.md#tests-and-checks) for PostgreSQL startup, isolated database creation and Chromium installation.

## Which command runs which tests?

| Command                    | What it runs                                                                            | Required services                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm test`                 | Vitest: `*.test.ts` and `*.test.tsx` in this folder, excluding `*.integration.test.ts`. | No running API, database or browser.                                                   |
| `npm run test:integration` | Vitest: `*.integration.test.ts`, currently `api.integration.test.ts`.                   | PostgreSQL with the isolated `venue_test` database.                                    |
| `npm run test:e2e`         | Playwright: browser tests under `e2e/`, currently `workflow.spec.ts`.                   | Chromium and PostgreSQL with `venue_e2e`; Playwright starts the test API and frontend. |
| `npm run test:compose`     | The standalone `compose-smoke.ts` script.                                               | The running local development Compose application.                                     |

The selection rules live in [vitest.config.ts](../vitest.config.ts), [vitest.integration.config.ts](../vitest.integration.config.ts) and [playwright.config.ts](../playwright.config.ts). The commands themselves live in [package.json](../package.json).

`npm run check` runs these steps in order and stops at the first failure:

```text
format:check → lint → typecheck → test → test:integration → test:e2e → build
```

Formatting, linting and type checking inspect source consistency and correctness without exercising user workflows. The final build checks that TypeScript passes and Vite can produce the production frontend bundle; it does not deploy the app. The Compose restart check is separate and is not included in `npm run check`.

## File map

| File                                               | Type                     | Main responsibility                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [domain.test.ts](domain.test.ts)                   | Unit                     | Calls recipe and pricing functions directly: unit conversion, substitutions, required choices, ingredient edits, rounding and serving sizes.                                                            |
| [deployment.test.ts](deployment.test.ts)           | Unit                     | Checks environment parsing, temporary secret-file handling and rejected production settings. It does not deploy or connect to PostgreSQL.                                                               |
| [architecture.test.ts](architecture.test.ts)       | Static source check      | Reads frontend imports and checks for cycles and shared modules importing features. Its regular-expression graph covers only supported relative imports, not every architecture rule.                   |
| [components.test.tsx](components.test.tsx)         | React component          | Renders waiter components and exercises customization, quantities, translations, loading/error states and preserved menu state with controlled API responses.                                           |
| [notes.test.tsx](notes.test.tsx)                   | React component/hook     | Checks pending note saves, failed saves, submitted-note handling and mutation queue/retry behavior.                                                                                                     |
| [session.test.tsx](session.test.tsx)               | React hook               | Checks session restoration, polling, expiry, logout and responses arriving after the active session has changed.                                                                                        |
| [app.test.tsx](app.test.tsx)                       | React composition        | Checks login errors, language/role selection, navigation guards, logout errors and preference retries. API responses and role views are replaced with controlled test implementations.                  |
| [api.integration.test.ts](api.integration.test.ts) | API/database integration | Exercises real API handlers and PostgreSQL: permissions, validation, retries, concurrent updates, stock consumption, rollback, historical snapshots, migrations and administrator-bootstrap safeguards. |
| [e2e/workflow.spec.ts](e2e/workflow.spec.ts)       | End-to-end browser       | Exercises manager, waiter and preparation workflows across browser sessions, German/English UI, connection failures, lost responses, responsive layouts and selected keyboard/touch interactions.       |
| [compose-smoke.ts](compose-smoke.ts)               | Persistence smoke check  | Creates a marked draft, restarts Compose, checks retained state/session and cancels the draft afterwards. It changes local application data and leaves verification history.                            |

Two additional files prepare the test environment rather than defining test cases:

- [setup.ts](setup.ts) adds DOM assertions and cleans up rendered React trees after tests. It supplies minimal dialog and `ResizeObserver` stubs for the simulated browser environment.
- [e2e/setup.ts](e2e/setup.ts) drops and recreates the fixed `venue_e2e` database's public schema, then runs migrations and demo seeding before browser workflows.

After meeting the corresponding suite's prerequisites, you can run one file or named case:

```sh
npm test -- tests/domain.test.ts
npm test -- tests/session.test.tsx
npm test -- tests/domain.test.ts -t "converts compatible units"
npm run test:integration -- tests/api.integration.test.ts
npm run test:e2e -- tests/e2e/workflow.spec.ts
```

# Testing principles
### Test structure and assertions

A test normally prepares an input, performs an action and asserts an expected result. For example, this assertion from `domain.test.ts` calls the real conversion function and compares its result with the expected string:

```ts
expect(convert("0.125", "kg", "g")).toBe("125");
```

If the function returns another value, the test fails. Other assertions check that invalid input throws an error, an API returns a particular status or an element appears on screen.

In Vitest files, `describe(...)` groups related cases and `it(...)` defines one case. Playwright uses `test(...)`. Setup hooks such as `beforeAll` and `beforeEach` prepare shared prerequisites or reset state; cleanup hooks release resources. A setup failure can therefore fail a whole suite before its individual cases run.

### React tests: components without a running server

React Testing Library renders components or hooks inside JSDOM, a simulated browser environment. Tests click controls, enter text and inspect the result. Mocks replace selected dependencies with predictable responses; for example, session tests can deliberately delay an API response until after logout.

This makes loading, failure and timing cases reproducible. It does not prove real browser layout or native dialog behavior: the setup stubs do not implement layout or focus trapping. Browser tests cover selected real rendering and interaction scenarios.

### Integration tests: real handlers and a real database

`api.integration.test.ts` creates the Fastify application and uses `app.inject(...)` to send requests directly through its request handling. A separately running HTTP server is unnecessary, but PostgreSQL must be reachable.

The suite checks that its connection string contains `venue_test`, runs migrations and seeding, and logs in as the seeded roles. Before each case it truncates operational tables; it does not recreate the entire database for each case. Assertions inspect API responses and persisted data. Some cases deliberately race requests or cause a database operation to fail to check deduplication and rollback.

The default connection uses localhost port `5432`; `TEST_DATABASE_URL` can override it. Keep the isolated `venue_test` database and do not run concurrent suites against the same database. An `ECONNREFUSED` error means the connection failed before the test could verify application behavior; start PostgreSQL and check the published port.

### Browser tests: the complete request path

Playwright opens Chromium and drives the actual frontend. Actions travel through the test API to PostgreSQL, so these tests exercise several layers together. Some scenarios deliberately intercept requests to simulate a lost response or failure.

The configuration starts the API on `3002` and frontend on `5180`, uses the fixed local `venue_e2e` database on port `5432`, and runs with one worker. It retains traces on failure. The current startup order requires initializing a newly created browser database before the first run; use the command in the [main test setup instructions](../README.md#tests-and-checks). The setup resets that database again on subsequent runs.

