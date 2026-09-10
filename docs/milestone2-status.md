# Milestone two verification

Implemented 2026-09-08 against [Milestone2.md](../../instructions/Milestone2.md). The specification and milestone-one business baseline remain intact.

## Delivered

Sequential tables/menu/choices/order workspaces; a desktop order side control and reachable phone control; translated preparation tiles; separate serving-size and item-count controls; explicit advanced ingredient editing; inline note saving/amendments; repeat ordering with atomic increments and durable retry deduplication; recoverable unsent removal; and localized validation/errors. Manager history, PostgreSQL persistence, exact price/recipe snapshots, stock consumption, cancellation/replacement and permissions remain in place.

Frontend modules now separate app composition, waiter/manager/preparation features, transport, preview lifecycle, notes, pure menu filtering and shared UI. Feature entry points and an import-graph test enforce acyclic dependencies. ESLint checks top-level function spacing; Prettier formats TSX and control flow.

Migration 2 preserves existing recipes/prices, orders, stock and historical snapshots, adds empty sizes to legacy products, and updates only untouched demo preparation labels. A separate seeded size demonstration product illustrates explicit recipes/prices. Actual commercial sizes remain a manager configuration task. See [configuration](configuration.md), [architecture mapping](architecture.md#milestone-two-frontend-boundaries), [API changes](api.md#milestone-two-additions) and [role guides](users.md).

## Baseline and final checks

The initial implementation passed lint, types, build, 11 unit/component tests, 12 integration tests and 3 browser workflows. Formatting already failed in `apps/web/src/Service.tsx`. Database/browser execution initially hit sandbox restrictions; reruns with local access passed. That formatting failure was resolved.

The combined `npm run check` gate passed after implementation:

| Command                    | Result                           |
| -------------------------- | -------------------------------- |
| `npm run format:check`     | Passed                           |
| `npm run lint`             | Passed                           |
| `npm run typecheck`        | Passed                           |
| `npm test`                 | 21 passed                        |
| `npm run test:integration` | 18 passed, isolated `venue_test` |
| `npm run test:e2e`         | 6 passed, isolated `venue_e2e`   |
| `npm run build`            | Passed                           |

The browser suite exercises the original English multi-session station/stock workflow, lost acknowledgements before/after refresh, German service, and additional 390×844, 820×1180 and 1440×1000 workflows. New checks cover size/count/preparation ordering, failed and slow note saves, retained text, three rapid repeats of a submitted item, keyboard Enter/focus, preserved menu search on browser back and horizontal overflow. Screenshots are generated under `test-results/choices-*.png`, `order-*.png` and `waiter-*.png`; phone/tablet/desktop screenshots were inspected.

PostgreSQL tests retain all original permissions, stock, cancellation, replacement, snapshot, revision and idempotency coverage, and add concurrent repeats across waiter/manager sessions, sent-to-unsent repetition, unchanged sent consumption, price review, distinct notes, zero decrement/Undo, serving-size multiplication and migration preservation. Component/domain tests exercise failed final-add selections, German validation, expanded/collapsed order, pending-note flushes, explicit submitted amendments and retention when preparation races note entry.

## Limits and operational notes

- Complex manager size/effect configuration uses the existing validated Advanced record JSON editor; no separate graphical mapping editor was introduced.
- If preparation starts during an unsaved submitted-note edit, the text remains available to copy into an explicit replacement. Discarding that unsaved text is explicit and never changes the saved ticket.
- Browser verification uses Chromium with simulated viewport dimensions, not Safari/Firefox or physical touch hardware. JSDOM reports its unimplemented `scrollTo` during component tests; real browser tests exercise navigation.
- The existing Docker files and named-volume design are preserved. Compose image rebuild/restart smoke testing was not repeated for this milestone; its earlier results remain in the milestone-one record. No normal venue data was reset and no external deployment was performed.
