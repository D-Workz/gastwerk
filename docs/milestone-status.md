# Milestone 1 status

For the current waiter milestone, see [milestone two verification](milestone2-status.md). This file retains the historical milestone-one evidence.

Implementation date: 2026-09-08. Baseline: [spec.md](../../instructions/milestone1.md), preserved without edits.

## Delivered

The integrated PostgreSQL application implements manager catalog/inventory/table/user maintenance, server-persisted waiter drafts and customizations, kitchen/bar routing, preparation and service closure. It includes recipe/price/policy snapshots, exact decimal calculations, attributable stock movements, server-side permissions, revision conflicts, durable request deduplication, amendments, quantity splits, cancellation/replacement, negative-stock warnings, translated interfaces and saved display preferences.

Pricing and served-correction reason policies are manager-editable and versioned. The backend is separated into Identity, Catalog, Inventory, Service, Fulfillment and Configuration modules. Common catalog and policy fields have forms; complete option-group/effect configuration is available through validated advanced records.

## Verification record

Verified on Linux with host Node 26.8.1/npm 12.0.2, PostgreSQL 18 in Docker, Chromium via Playwright, and Node 24 in production containers.

| Check                          | Result                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `npm run format:check`         | Passed                                                                                              |
| `npm run lint`                 | Passed                                                                                              |
| `npm run typecheck`            | Passed                                                                                              |
| `npm test`                     | 11 passed: 6 domain and 5 component tests                                                           |
| `npm run test:integration`     | 12 passed against isolated PostgreSQL                                                               |
| `npm run test:e2e`             | 3 passed: multi-session English workflow, lost-response retries and German workflow                 |
| `npm run build`                | Passed, including strict type checking                                                              |
| `docker compose up -d --build` | API, web and database built/started; all three healthy                                              |
| `npm run test:compose`         | Restart preserved orders, stock, configuration and session; verification draft cancelled afterwards |

The final `npm run check` passed in full: 26 automated tests plus formatting, linting, strict type checking and the production build. The separate Compose restart smoke test also passed. No required check was left unrun.

## Acceptance evidence

| Spec scenario                | Evidence                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Clean startup             | Compose build/start, migrations/seeding, repeated seed integration test and restart smoke test                                                                  |
| 2. Apple juice choices       | Required-choice domain/component tests; sparkling browser workflow; pure/still/sparkling configuration in deterministic seed                                    |
| 3. Recipe customization      | Component and browser tests remove/restore onions, add a cheese portion and advanced-only ingredient; server preview and immutable recipe domain assertions     |
| 4. Notes and distinct lines  | Browser save/refresh/station note checks; split/attribution PostgreSQL test; each add persists a separate line                                                  |
| 5. Layout parity             | Component tests run Add/Edit in list and tiles; browser switches map/list and verifies preferences after sign-in                                                |
| 6. Routing/live state        | Separate waiter, manager/kitchen and bar browser sessions; station update assertion within three seconds; draft invisibility checks                             |
| 7. Consumption               | PostgreSQL racing preparation/retries; exact 250 ml juice/water deduction; injected insert failure rolls back all stock and state                               |
| 8. Cancellation              | PostgreSQL pre-start cancellation consumes nothing; replacement/post-start cancellation retain stock; ready/served do not deduct again                          |
| 9. Amendments                | Revision/split audit and stale station conflict tests; atomic replacement/cancellation test                                                                     |
| 10. Concurrent waiters       | Simultaneous additions preserve both; racing edits return success/conflict; repeated add/send keys do not duplicate                                             |
| 11. Catalog history          | Price/recipe snapshot test; archived ingredient and original pricing-policy edit/preview regression test                                                        |
| 12. Authorization/validation | Direct unauthorized stock/order operations, unauthenticated access, CSRF, missing choices, incompatible conversions and invalid domain inputs                   |
| 13. Persistence/reconnection | Compose restart smoke test, browser offline/reconnect, lost mutation response retry before and after refresh                                                    |
| 14. Closure                  | Unfinished-close rejection, completed browser closure, new order on freed table; no payment records exist                                                       |
| 15. Localization             | German/English dictionaries, translated seed, locale numbers/EUR/Vienna dates; browser language and German workflow checks                                      |
| 16. Inventory warning        | Integration preparation with zero stock results in negative exact ledger balances; UI renders explicit negative/low-stock warnings without blocking preparation |

The table identifies actual evidence; it does not claim every combination of options, screen size or lifecycle has its own browser test.

## Deliberate implementation choices and limits

- Recipes are flat product-owned recipes, snapshotted on lines, rather than a separately reusable recipe library.
- Guided groups are single-choice, ordered by their array positions. Complex group/effect editing uses the advanced JSON record; no conditional workflow builder is included.
- Station identities are fixed to kitchen/bar. Product routing and station-role assignments are editable.
- Two-second full-state polling is appropriate to this single-venue milestone. Large-history pagination and load testing are not implemented. The event view shows the latest 200 events; all audit events remain in PostgreSQL, and closed order history remains available.
- Supported browser automation covers Chromium desktop and a 390 px viewport. Safari, Firefox, real touch hardware and production load have not been separately tested.
- Demonstration login and local Compose operation are delivered. No external deployment, HTTPS proxy provisioning, license selection, payments or fiscal functionality was performed.
- The original specification contains encoding artifacts. Its content was preserved; generated interface text and documentation use normal UTF-8.

## Handoff

The local Compose application remains running at http://localhost:5173. See the repository [README](../README.md) for exact startup and test commands, and [configuration guide](configuration.md) for policy changes. The restart smoke test intentionally leaves one attributable cancelled verification line in history.
