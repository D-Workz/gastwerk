# Browser application

React/Vite frontend. [src/main.tsx](src/main.tsx) mounts [App](src/app/App.tsx), which connects role views, language/navigation state and retries. Session/snapshot lifecycle lives in useSession, refresh scheduling in usePolling, and login/header/history/stock presentation in dedicated components; see the [app guide](src/app/README.md).

## How to navigate the browser app

Web is the React application that runs in the visitor's browser. It displays server data, collects input and sends HTTP requests to the API. It does not access PostgreSQL directly or decide authoritative prices and permissions.

| Location under `src/` | Purpose | Start here |
| --- | --- | --- |
| `main.tsx` | Start React and load global styles. | [Browser entry point](src/main.tsx) |
| `app/` | Assemble login, role views, data refresh, retries and the source bar. | [App composition guide](src/app/README.md) |
| `features/waiter/` | Tables, menu, choices, customization and orders. | [Waiter guide](src/features/waiter/README.md) |
| `features/preparation/` | Kitchen/bar queues and preparation controls. | [Preparation guide](src/features/preparation/README.md) |
| `features/manager/` | Catalog, policy, inventory and user administration. | [Manager guide](src/features/manager/README.md) |
| `shared/` | Browser API calls, retry state, translations and common controls. | [Shared browser guide](src/shared/README.md) |
| `style.css` | Global typography, controls and shared layouts. | [Styles](src/style.css) |

A feature is a related set of screens and interactions. A hook such as `useMutation` manages state and effects reused by components. `App.tsx` connects these pieces and passes server state and mutation callbacks into features.

`web/shared` contains browser-specific reusable code, including order-line controls that understand the restaurant workflow. [Packages](../../packages/README.md) contain definitions shared with the API or generic React controls: `Field` belongs in packages/ui, while the restaurant-aware `LineCard` belongs in web/shared/ui.

## How a screen reaches the server

For example, a kitchen worker selects Start preparing on a ticket. The shared LineCard sends a revision-bearing mutation through the browser's retry mechanism and HTTP helper. The API checks the session, permission and current item state before changing it and recording ingredient consumption. The browser refreshes application state after a successful mutation.

While signed in, the session hook uses usePolling to schedule a state fetch every two seconds and refreshes on window focus or reconnection. This is polling, not a server-push connection or a guaranteed freshness deadline. A visible role-specific button does not grant permission; the API checks requests independently.

## Structural limitations to keep in view

These are current code-organization observations, not fixes made by this guide:

- Session/snapshot ownership, polling and presentation are separated within app/. App still coordinates role navigation and waiter guards; see [extension boundaries](src/app/README.md#extending-and-remaining-boundaries).
- Feature orchestration is uneven: waiter Service owns many callbacks and navigation state; manager owns extra reads as well as editor state. Details belong in the [waiter](src/features/waiter/README.md) and [manager](src/features/manager/README.md) guides. This does not require turning every component into a separate hook.
- Global styles include feature-specific layouts alongside generic rules; waiter has a separate scoped stylesheet, and SourceBar uses a CSS module. Future layout changes must inspect both sources of styling.
- Shared response-contract ownership spans browser and API tests; the issue is recorded once in the [main README](../../README.md#shared-response-contract-ownership).

## Module entry points

- [Waiter](src/features/waiter/README.md): table/menu/customization/order navigation and note orchestration.
- [Manager](src/features/manager/README.md): catalog, policy, stock and user administration.
- [Preparation](src/features/preparation/README.md): kitchen/bar queue projection.
- [Shared web code](src/shared/README.md): API transport, mutation retries, translations and common controls.
- [Generic UI](../../packages/ui/README.md), [contracts](../../packages/contracts/README.md) and [config](../../packages/config/README.md): directly imported shared source.

Create a new meaningful feature under `src/features/`, export its public composition component from `index.ts`, and compose it in App. Read its owning module before changing existing behavior. App passes polled state and the shared mutation function; preview-specific transport can stay in the feature while calling shared `api`. Frontend role visibility does not grant API permission. See the [architecture map](../../docs/architecture.md) for backend counterparts.

## Runtime and checks

Run commands from `gastwerk/`, not this directory. `npm run dev:web` uses [vite.config.ts](vite.config.ts) and proxies `/api` to the API; follow [local setup](../../README.md#develop-locally). `npm run build` performs TypeScript checks and outputs `apps/web/dist/`. [Dockerfile](Dockerfile) builds static assets and serves them with [nginx.conf](nginx.conf); `/api/` is proxied and other paths fall back to `index.html`.

`npm test` covers components, notes, the import graph and domain behavior without PostgreSQL. `npm run test:e2e` requires Chromium and the fixed isolated `venue_e2e` database; setup drops that test schema, so it is not a harmless live-site smoke check. See [test prerequisites](../../README.md#tests-and-checks) and [executed checks](../../docs/milestone-3-review.md#verification). The regex-based graph test checks relative static imports inside web/src for cycles and shared-to-feature dependencies; it does not enforce every intended boundary or all possible import forms.

## Source bar

App renders one [SourceBar](src/app/SourceBar.tsx) before login and authenticated content, including inside an iframe. [Public source configuration](src/app/source.ts) links to `https://github.com/D-Workz/gastwerk/tree/production`. The badge names the linked branch, not an exact deployed revision. The local inline GitHub Octicons mark needs no external service or CSP change.

The sticky bar stays in document flow. ResizeObserver publishes `--source-bar-height` for document focus scrolling and the waiter workspace sticky toolbar; keep that offset when changing navigation. Native modal dialogs remain above the bar in the browser top layer. Styling is scoped in [source-bar.module.css](src/app/source-bar.module.css), independently of the portfolio. URLs are compiled public values; no environment or production build setting is added.
